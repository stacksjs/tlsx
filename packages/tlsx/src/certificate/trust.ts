import type { CAOptions, Cert, CertPath, TlsOption } from '../types'
import type { LinuxTrustEnv } from './linux-trust'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { config } from '../config'
import { CERT_CONSTANTS, LOG_CATEGORIES } from '../constants'
import { debugLog, findFoldersWithFile, log, normalizeCertPaths, runCommand, safeStringify } from '../utils'
import { createRootCA } from './generate'
import { installCAIntoLinuxSystemStore, isCertTrustedOnLinux, removeCAFromLinuxSystemStore } from './linux-trust'
import { storeCACertificate, storeCertificate } from './store'
import { getCertCommonName, getCertSha256Fingerprint } from './validation'

/**
 * Options shared by every trust-store entry point. `linux` carries the
 * environment hooks for the Linux system store (filesystem root, command
 * runner, root detection) and is ignored on other platforms.
 */
export interface TrustStoreOptions extends TlsOption {
  linux?: LinuxTrustEnv
}

/** Which store a {@link TrustStoreReport} entry refers to. */
export type TrustStoreKind = 'macos-keychain' | 'windows-root' | 'linux-system' | 'linux-nss'

export type TrustStoreStatus = 'installed' | 'already-trusted' | 'removed' | 'skipped' | 'failed'

export interface TrustStoreEntry {
  store: TrustStoreKind
  /** Keychain path, anchor file, NSS db directory, and so on. */
  location: string
  status: TrustStoreStatus
  /** Why it was skipped or how it failed. */
  detail?: string
}

/**
 * What a trust-store operation actually did, store by store. `trusted` is
 * true when at least one store now holds the CA (installed on this run or
 * found there already).
 */
export interface TrustStoreReport {
  platform: string
  stores: TrustStoreEntry[]
  trusted: boolean
}

function summarize(platform: string, stores: TrustStoreEntry[]): TrustStoreReport {
  return {
    platform,
    stores,
    trusted: stores.some(s => s.status === 'installed' || s.status === 'already-trusted'),
  }
}

/**
 * Check if a certificate is already trusted in the system trust store
 * This helps avoid unnecessary sudo prompts
 */
async function isCertAlreadyTrusted(certPath: string, verbose?: boolean, linux?: LinuxTrustEnv): Promise<boolean> {
  const platform = os.platform()

  if (platform === 'linux') {
    // Fingerprint lookup in the distro's consolidated bundle; no openssl.
    const trusted = isCertTrustedOnLinux(certPath, linux?.root)
    debugLog(LOG_CATEGORIES.TRUST, trusted ? 'Certificate found in the system CA bundle' : 'Certificate not in the system CA bundle', verbose)
    return trusted
  }

  if (platform !== 'darwin') {
    // Windows has no cheap fingerprint lookup wired up; let the normal flow proceed.
    return false
  }

  try {
    // Fingerprint via Node's X509Certificate (no openssl): uppercase hex, no colons.
    const fingerprintValue = getCertSha256Fingerprint(certPath)

    if (!fingerprintValue) {
      debugLog(LOG_CATEGORIES.TRUST, 'Could not extract certificate fingerprint', verbose)
      return false
    }

    // `security -Z` already prints "SHA-256 hash: <HEX>" per cert, so parse
    // those directly instead of piping the keychain through openssl.
    try {
      const keychainOutput = execSync('security find-certificate -a -Z 2>/dev/null || true').toString()
      const found = keychainOutput.split('\n').some((line) => {
        const m = line.match(/SHA-256 hash:\s*([A-F0-9]+)/i)
        return !!m && m[1]!.toUpperCase() === fingerprintValue
      })

      if (found) {
        debugLog(LOG_CATEGORIES.TRUST, 'Certificate fingerprint found in system keychain', verbose)
        return true
      }
    }
    catch {
      // Ignore errors in keychain check
    }

    debugLog(LOG_CATEGORIES.TRUST, 'Certificate fingerprint not found in system keychain', verbose)
    return false
  }
  catch (error) {
    debugLog(LOG_CATEGORIES.TRUST, `Error checking certificate trust: ${error}`, verbose)
    return false
  }
}

/**
 * Whether the CA is already trusted by the current platform's system store.
 * macOS reads the keychain's SHA-256 hashes; Linux searches the distro's
 * consolidated PEM bundle by fingerprint; Windows always reports false
 * (there is no cheap lookup, so callers fall through to `certutil`).
 * @param caCertPemOrPath - The CA certificate as PEM or a path to it.
 * @param options - Verbosity and, on Linux, the environment hooks.
 */
export async function isCertTrusted(caCertPemOrPath: string, options?: TrustStoreOptions): Promise<boolean> {
  return isCertAlreadyTrusted(caCertPemOrPath, options?.verbose, options?.linux)
}

// Define platform-specific trust store handlers
interface TrustStoreHandler {
  addCertificate: (caCertPath: string, options?: TrustStoreOptions) => Promise<TrustStoreReport>
  removeCertificate?: (caCertPath: string, options?: TrustStoreOptions, certName?: string) => Promise<void>
  platform: string
}

const MACOS_SYSTEM_KEYCHAIN = '/Library/Keychains/System.keychain'

// macOS trust store handler
const macOSTrustStoreHandler: TrustStoreHandler = {
  platform: 'darwin',
  async addCertificate(caCertPath: string, options?: TrustStoreOptions): Promise<TrustStoreReport> {
    // Check if already trusted to avoid unnecessary sudo prompts
    const alreadyTrusted = await isCertAlreadyTrusted(caCertPath, options?.verbose)
    if (alreadyTrusted) {
      debugLog(LOG_CATEGORIES.TRUST, 'Certificate is already trusted, skipping trust store update', options?.verbose)
      log.success('Certificate is already trusted in system keychain')
      return summarize('darwin', [{ store: 'macos-keychain', location: MACOS_SYSTEM_KEYCHAIN, status: 'already-trusted' }])
    }

    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to macOS keychain', options?.verbose)
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k ${MACOS_SYSTEM_KEYCHAIN} ${caCertPath}`,
    )
    return summarize('darwin', [{ store: 'macos-keychain', location: MACOS_SYSTEM_KEYCHAIN, status: 'installed' }])
  },
  async removeCertificate(caCertPath: string, options?: TrustStoreOptions, certName?: string): Promise<void> {
    const certificateName = certName || config.commonName
    debugLog(LOG_CATEGORIES.TRUST, `Removing certificate ${certificateName} from macOS keychain`, options?.verbose)
    try {
      await runCommand(
        `sudo security delete-certificate -c "${certificateName}" ${MACOS_SYSTEM_KEYCHAIN}`,
      )
      debugLog(LOG_CATEGORIES.TRUST, `Removed certificate ${certificateName} from macOS keychain`, options?.verbose)
    }
    catch (error) {
      debugLog(LOG_CATEGORIES.TRUST, `Error removing certificate: ${error}`, options?.verbose)
      throw error
    }
  },
}

// Windows trust store handler
const windowsTrustStoreHandler: TrustStoreHandler = {
  platform: 'win32',
  async addCertificate(caCertPath: string, options?: TrustStoreOptions): Promise<TrustStoreReport> {
    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to Windows certificate store', options?.verbose)
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
    return summarize('win32', [{ store: 'windows-root', location: 'LocalMachine\\Root', status: 'installed' }])
  },
  async removeCertificate(caCertPath: string, options?: TrustStoreOptions, certName?: string): Promise<void> {
    const certificateName = certName || config.commonName
    debugLog(LOG_CATEGORIES.TRUST, `Removing certificate ${certificateName} from Windows certificate store`, options?.verbose)
    try {
      await runCommand(`certutil -delstore -enterprise Root "${certificateName}"`)
      debugLog(LOG_CATEGORIES.TRUST, `Removed certificate ${certificateName} from Windows certificate store`, options?.verbose)
    }
    catch (error) {
      debugLog(LOG_CATEGORIES.TRUST, `Error removing certificate: ${error}`, options?.verbose)
      throw error
    }
  },
}

// Linux trust store handler.
//
// Two stores, both additive. The distro-wide store (update-ca-certificates
// and friends) is what a headless box needs and runs first; the NSS/certutil
// pass then reaches any browser profiles under $HOME. Neither depends on the
// other succeeding, and the report says exactly which ones took the CA.
const linuxTrustStoreHandler: TrustStoreHandler = {
  platform: 'linux',
  async addCertificate(caCertPath: string, options?: TrustStoreOptions): Promise<TrustStoreReport> {
    const verbose = options?.verbose
    const stores: TrustStoreEntry[] = []

    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to the Linux system trust store', verbose)
    const system = await installCAIntoLinuxSystemStore(caCertPath, { ...options?.linux, verbose })
    const systemLocation = system.anchorPath ?? '(no supported anchor directory)'
    if (system.status === 'installed') {
      log.success(`Root CA installed into the ${system.family} system trust store (${system.anchorPath})`)
      stores.push({ store: 'linux-system', location: systemLocation, status: 'installed' })
    }
    else if (system.status === 'already-trusted') {
      log.success('Root CA is already in the system CA bundle')
      stores.push({ store: 'linux-system', location: systemLocation, status: 'already-trusted' })
    }
    else if (system.status === 'failed') {
      log.warn(`Could not update the ${system.family} system trust store: ${system.error}`)
      stores.push({ store: 'linux-system', location: systemLocation, status: 'failed', detail: system.error })
    }
    else {
      debugLog(LOG_CATEGORIES.TRUST, `System trust store skipped: ${system.error}`, verbose)
      stores.push({ store: 'linux-system', location: systemLocation, status: 'skipped', detail: system.error })
    }
    const systemOk = system.status === 'installed' || system.status === 'already-trusted'

    const rootDirectory = os.homedir()
    const targetFileName = CERT_CONSTANTS.LINUX_CERT_DB_FILENAME
    const args = CERT_CONSTANTS.LINUX_TRUST_ARGS

    debugLog(LOG_CATEGORIES.TRUST, `Searching for certificate databases in ${rootDirectory}`, verbose)
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    if (foldersWithFile.length === 0) {
      // Only worth a warning when nothing else took the CA either.
      if (systemOk)
        debugLog(LOG_CATEGORIES.TRUST, 'No NSS certificate databases found; the system store covers this host', verbose)
      else
        log.warn('No certificate databases found and the system trust store was not updated. Certificate may not be trusted by the system.')
      return summarize('linux', stores)
    }

    for (const folder of foldersWithFile) {
      debugLog(LOG_CATEGORIES.TRUST, `Processing certificate database in ${folder}`, verbose)
      try {
        debugLog(LOG_CATEGORIES.TRUST, `Attempting to delete existing cert for ${config.commonName}`, verbose)
        await runCommand(`certutil -d sql:${folder} -D -n ${config.commonName}`)
      }
      catch (error) {
        debugLog(LOG_CATEGORIES.TRUST, `Warning: Error deleting existing cert: ${error}`, verbose)
        console.warn(`Error deleting existing cert: ${error}`)
      }

      debugLog(LOG_CATEGORIES.TRUST, `Adding new certificate to ${folder}`, verbose)
      try {
        await runCommand(`certutil -d sql:${folder} -A -t ${args} -n ${config.commonName} -i ${caCertPath}`)
        log.info(`Cert added to ${folder}`)
        stores.push({ store: 'linux-nss', location: folder, status: 'installed' })
      }
      catch (error) {
        // A dead browser profile must not undo a successful system install.
        if (!systemOk)
          throw error
        debugLog(LOG_CATEGORIES.TRUST, `certutil failed for ${folder}: ${error}`, verbose)
        stores.push({ store: 'linux-nss', location: folder, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
      }
    }

    return summarize('linux', stores)
  },
  async removeCertificate(caCertPath: string, options?: TrustStoreOptions, certName?: string): Promise<void> {
    const certificateName = certName || config.commonName
    debugLog(LOG_CATEGORIES.TRUST, `Removing certificate ${certificateName} from Linux certificate store`, options?.verbose)

    const system = await removeCAFromLinuxSystemStore(certificateName, { ...options?.linux, verbose: options?.verbose })
    if (system.status === 'removed')
      log.info(`Removed ${system.anchorPath} from the ${system.family} system trust store`)
    else if (system.status === 'failed')
      log.warn(`Could not remove the CA from the system trust store: ${system.error}`)
    else
      debugLog(LOG_CATEGORIES.TRUST, `System trust store removal: ${system.status}`, options?.verbose)

    const rootDirectory = os.homedir()
    const targetFileName = CERT_CONSTANTS.LINUX_CERT_DB_FILENAME

    debugLog(LOG_CATEGORIES.TRUST, `Searching for certificate databases in ${rootDirectory}`, options?.verbose)
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    if (foldersWithFile.length === 0) {
      log.warn('No certificate databases found. Cannot remove certificate.')
      return
    }

    for (const folder of foldersWithFile) {
      debugLog(LOG_CATEGORIES.TRUST, `Processing certificate database in ${folder}`, options?.verbose)
      try {
        await runCommand(`certutil -d sql:${folder} -D -n "${certificateName}"`)
        log.info(`Cert removed from ${folder}`)
      }
      catch (error) {
        debugLog(LOG_CATEGORIES.TRUST, `Error removing cert from ${folder}: ${error}`, options?.verbose)
        console.warn(`Error removing cert from ${folder}: ${error}`)
      }
    }
  },
}

// Map of platform-specific handlers
const trustStoreHandlers: Record<string, TrustStoreHandler> = {
  darwin: macOSTrustStoreHandler,
  win32: windowsTrustStoreHandler,
  linux: linuxTrustStoreHandler,
}

/**
 * Add a certificate to the system trust store and save the certificate to a file
 * @param cert - Certificate and private key
 * @param caCert - CA Certificate
 * @param options - TLS options
 * @returns The path to the stored certificate
 */
export async function addCertToSystemTrustStoreAndSaveCert(cert: Cert, caCert: string, options?: TrustStoreOptions): Promise<CertPath> {
  debugLog(LOG_CATEGORIES.TRUST, `Adding certificate to system trust store with options: ${safeStringify(options)}`, options?.verbose)
  debugLog(LOG_CATEGORIES.TRUST, 'Storing certificate and private key', options?.verbose)
  const certPath = storeCertificate(cert, options)

  debugLog(LOG_CATEGORIES.TRUST, 'Storing CA certificate', options?.verbose)
  const caCertPath = storeCACertificate(caCert, options)

  const platform = os.platform()
  debugLog(LOG_CATEGORIES.TRUST, `Detected platform: ${platform}`, options?.verbose)

  const handler = trustStoreHandlers[platform]
  if (!handler) {
    const errorMsg = `Unsupported platform: ${platform}`
    debugLog(LOG_CATEGORIES.TRUST, `Error: ${errorMsg}`, options?.verbose)
    throw new Error(errorMsg)
  }

  await handler.addCertificate(caCertPath, options)

  debugLog(LOG_CATEGORIES.TRUST, 'Certificate successfully added to system trust store', options?.verbose)
  return certPath
}

/**
 * Install an existing CA certificate file into the system trust store and
 * report which stores took it. This is the reporting sibling of
 * `addCertToSystemTrustStoreAndSaveCert`: nothing is written to `basePath`,
 * and the return value says what happened per store instead of a path.
 * @param caCertPath - Path to the CA certificate (PEM).
 * @param options - TLS options plus, on Linux, the environment hooks.
 */
export async function addCertToSystemTrustStore(caCertPath: string, options?: TrustStoreOptions): Promise<TrustStoreReport> {
  const platform = os.platform()
  debugLog(LOG_CATEGORIES.TRUST, `Adding ${caCertPath} to the ${platform} trust store`, options?.verbose)

  const handler = trustStoreHandlers[platform]
  if (!handler)
    throw new Error(`Unsupported platform: ${platform}`)

  return handler.addCertificate(caCertPath, options)
}

/**
 * Remove a certificate from the system trust store
 * @param domain - Domain of the certificate to remove
 * @param options - TLS options
 * @param certName - Optional specific certificate name to remove (defaults to config.commonName)
 */
export async function removeCertFromSystemTrustStore(domain: string, options?: TrustStoreOptions, certName?: string): Promise<void> {
  debugLog(LOG_CATEGORIES.TRUST, `Removing certificate for ${domain} from system trust store`, options?.verbose)

  // We should use the caCertPath since that's what's actually added to the trust store
  const caCertPath = options?.caCertPath || config.caCertPath
  // Use provided certName or default to config.commonName
  const certificateName = certName || config.commonName

  const platform = os.platform()
  debugLog(LOG_CATEGORIES.TRUST, `Detected platform: ${platform}`, options?.verbose)

  const handler = trustStoreHandlers[platform]
  if (!handler) {
    const errorMsg = `Unsupported platform: ${platform}`
    debugLog(LOG_CATEGORIES.TRUST, `Error: ${errorMsg}`, options?.verbose)
    throw new Error(errorMsg)
  }

  if (!handler.removeCertificate) {
    throw new Error(`Removing certificates is not supported on ${platform}`)
  }

  await handler.removeCertificate(caCertPath, options, certificateName)

  debugLog(LOG_CATEGORIES.TRUST, `Certificate for ${domain} successfully removed from system trust store`, options?.verbose)
}

/**
 * Clean up all TLSX certificates from the system trust store
 * This function removes all certificates created by TLSX from the system trust store
 * @param options - TLS options
 * @param certNamePattern - Optional pattern to match certificate names (defaults to all TLSX certificates)
 * @returns Promise that resolves when all certificates have been removed
 */
export async function cleanupTrustStore(options?: TlsOption, certNamePattern?: string): Promise<void> {
  const verbose = options?.verbose || config.verbose
  debugLog(LOG_CATEGORIES.TRUST, 'Cleaning up all TLSX certificates from system trust store', verbose)

  const platform = os.platform()
  debugLog(LOG_CATEGORIES.TRUST, `Detected platform: ${platform}`, verbose)

  const handler = trustStoreHandlers[platform]
  if (!handler) {
    const errorMsg = `Unsupported platform: ${platform}`
    debugLog(LOG_CATEGORIES.TRUST, `Error: ${errorMsg}`, verbose)
    throw new Error(errorMsg)
  }

  if (!handler.removeCertificate) {
    throw new Error(`Removing certificates is not supported on ${platform}`)
  }

  try {
    // Platform-specific cleanup implementations
    if (platform === 'darwin') {
      // On macOS, find and remove all certificates with our organization name
      debugLog(LOG_CATEGORIES.TRUST, 'Removing all TLSX certificates from macOS keychain', verbose)

      // If a specific pattern is provided, use it instead of the default
      const searchPattern = certNamePattern || config.commonName

      await runCommand(
        `sudo security find-certificate -a -c "${searchPattern}" -Z /Library/Keychains/System.keychain | grep SHA-1 | awk '{print $3}' | xargs -I {} sudo security delete-certificate -Z {} /Library/Keychains/System.keychain`,
      )
      log.success(`All certificates matching "${searchPattern}" removed from macOS keychain`)
    }
    else if (platform === 'win32') {
      // On Windows, remove certificates based on our organization name or pattern
      debugLog(LOG_CATEGORIES.TRUST, 'Removing all TLSX certificates from Windows certificate store', verbose)

      // If a specific pattern is provided, use it instead of the default
      const searchPattern = certNamePattern || config.organizationName

      await runCommand(`certutil -delstore -enterprise Root "${searchPattern}"`)
      log.success(`All certificates matching "${searchPattern}" removed from Windows certificate store`)
    }
    else if (platform === 'linux') {
      // On Linux, we need to search through certificate databases
      debugLog(LOG_CATEGORIES.TRUST, 'Removing all TLSX certificates from Linux certificate stores', verbose)
      const rootDirectory = os.homedir()
      const targetFileName = CERT_CONSTANTS.LINUX_CERT_DB_FILENAME

      debugLog(LOG_CATEGORIES.TRUST, `Searching for certificate databases in ${rootDirectory}`, verbose)
      const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

      if (foldersWithFile.length === 0) {
        log.warn('No certificate databases found. Cannot clean up certificates.')
        return
      }

      // For each database, list and remove certificates created by TLSX
      for (const folder of foldersWithFile) {
        debugLog(LOG_CATEGORIES.TRUST, `Processing certificate database in ${folder}`, verbose)
        try {
          // Get list of certificates in the database
          const { stdout } = await runCommand(`certutil -d sql:${folder} -L`)

          // Parse the output to find certificates with our organization name or matching the pattern
          const lines = stdout.split('\n')
          for (const line of lines) {
            // Look for certificates with our organization name or common name pattern
            const shouldRemove = certNamePattern
              ? line.toLowerCase().includes(certNamePattern.toLowerCase())
              : (line.includes(config.organizationName) || line.includes('tlsx') || line.includes('Local Development'))

            if (shouldRemove) {
              // Extract the certificate name - it's the first part of the line before spaces
              const certName = line.split(/\s+/)[0].trim()
              if (certName) {
                debugLog(LOG_CATEGORIES.TRUST, `Removing certificate: ${certName}`, verbose)
                try {
                  await runCommand(`certutil -d sql:${folder} -D -n "${certName}"`)
                  log.info(`Removed certificate ${certName} from ${folder}`)
                }
                catch (error) {
                  debugLog(LOG_CATEGORIES.TRUST, `Error removing cert ${certName}: ${error}`, verbose)
                }
              }
            }
          }
        }
        catch (error) {
          debugLog(LOG_CATEGORIES.TRUST, `Error processing database ${folder}: ${error}`, verbose)
          console.warn(`Error processing database ${folder}: ${error}`)
        }
      }

      log.success('All matching certificates removed from Linux certificate stores')
    }

    debugLog(LOG_CATEGORIES.TRUST, 'Trust store cleanup completed successfully', verbose)
  }
  catch (error) {
    debugLog(LOG_CATEGORIES.TRUST, `Error cleaning up trust store: ${error}`, verbose)
    throw new Error(`Failed to clean up trust store: ${error}`)
  }
}

export interface InstallCAOptions extends TrustStoreOptions {
  /** Forwarded to `createRootCA` when generating a fresh CA. */
  ca?: CAOptions
}

export interface InstallCAResult {
  caCertPath: string
  caKeyPath: string
  /** True if a fresh CA was minted (vs. reusing the existing one on disk). */
  generated: boolean
  /** True if we actually wrote to the system trust store on this run. */
  trustInstalled: boolean
  /** True if the CA was already trusted before this call. */
  alreadyTrusted: boolean
  /** Per-store outcome, so callers can tell a system-store install from an NSS one. */
  report: TrustStoreReport
}

/**
 * mkcert-style "install the local CA", idempotent. Generates the Root CA on
 * first run, persists it under the configured `basePath`, and installs ONLY
 * the CA cert into the system trust store. Subsequent host certs derived from
 * this CA are trusted automatically without re-prompting.
 *
 * Subsequent calls are no-ops if the CA is already on disk and trusted.
 */
export async function installCA(options?: InstallCAOptions): Promise<InstallCAResult> {
  const verbose = options?.verbose ?? config.verbose
  const { caCertPath, basePath } = normalizeCertPaths({
    basePath: options?.basePath,
    caCertPath: options?.caCertPath,
  })
  // Co-locate the CA private key next to the cert. We use a fixed `.key`
  // filename to keep this discoverable from the install/uninstall pair.
  const caKeyPath = caCertPath.replace(/\.crt$/, '.key')

  debugLog(LOG_CATEGORIES.TRUST, `installCA: caCertPath=${caCertPath}`, verbose)
  debugLog(LOG_CATEGORIES.TRUST, `installCA: basePath=${basePath}`, verbose)

  // Reuse the existing CA on disk if both files are present. Generating a new
  // CA when one already exists would orphan every host cert that derives from it.
  let generated = false
  if (!(fs.existsSync(caCertPath) && fs.existsSync(caKeyPath))) {
    debugLog(LOG_CATEGORIES.TRUST, 'No existing Root CA found, generating one', verbose)
    const ca = await createRootCA({ ...options?.ca, verbose })
    storeCACertificate(ca.certificate, { ...options, basePath, caCertPath })
    fs.writeFileSync(caKeyPath, ca.privateKey, { mode: 0o600 })
    generated = true
    log.success(`Generated new Root CA at ${caCertPath}`)
  }
  else {
    debugLog(LOG_CATEGORIES.TRUST, 'Reusing existing Root CA on disk', verbose)
    log.info(`Using existing Root CA at ${caCertPath}`)
  }

  const platform = os.platform()
  const handler = trustStoreHandlers[platform]
  if (!handler)
    throw new Error(`installCA: unsupported platform: ${platform}`)

  // The macOS and Linux checks detect "already trusted" via fingerprint match
  // (keychain hashes, system CA bundle) and short-circuit without sudo. We
  // mirror that signal up to callers.
  const alreadyTrusted = await isCertAlreadyTrusted(caCertPath, verbose, options?.linux)
  if (alreadyTrusted) {
    log.success('Root CA is already trusted in the system store')
    const store: TrustStoreKind = platform === 'linux' ? 'linux-system' : 'macos-keychain'
    const location = platform === 'linux' ? 'system CA bundle' : MACOS_SYSTEM_KEYCHAIN
    const report = summarize(platform, [{ store, location, status: 'already-trusted' }])
    return { caCertPath, caKeyPath, generated, trustInstalled: false, alreadyTrusted: true, report }
  }

  const report = await handler.addCertificate(caCertPath, options)
  if (report.trusted)
    log.success('Root CA installed in the system trust store')
  else
    log.warn('Root CA was not installed into any trust store; see the report for details')
  return { caCertPath, caKeyPath, generated, trustInstalled: report.trusted, alreadyTrusted: false, report }
}

export interface UninstallCAOptions extends TrustStoreOptions {
  /**
   * Override the CN used to identify the CA in the trust store. Defaults to
   * the CN baked into the on-disk CA certificate, falling back to
   * `config.commonName`.
   */
  certName?: string
  /** Also delete the CA cert + key from `basePath`. Default: false. */
  deleteFiles?: boolean
}

export interface UninstallCAResult {
  removedFromTrustStore: boolean
  filesDeleted: boolean
  caCertPath: string
  caKeyPath: string
}

/**
 * Inverse of `installCA`. Removes the Root CA from the system trust store
 * (using its on-disk CN when available) and optionally deletes the cert + key
 * from `basePath`.
 */
export async function uninstallCA(options?: UninstallCAOptions): Promise<UninstallCAResult> {
  const verbose = options?.verbose ?? config.verbose
  const { caCertPath } = normalizeCertPaths({
    basePath: options?.basePath,
    caCertPath: options?.caCertPath,
  })
  const caKeyPath = caCertPath.replace(/\.crt$/, '.key')

  // Prefer the CN baked into the actual CA file (more reliable than guessing
  // from config when the user customized commonName at generation time).
  let certName = options?.certName
  if (!certName && fs.existsSync(caCertPath)) {
    try {
      // CN straight from the parsed cert (no openssl).
      certName = getCertCommonName(caCertPath) || undefined
      debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: extracted CN from cert: ${certName}`, verbose)
    }
    catch (err) {
      debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: CN extraction failed: ${err}`, verbose)
    }
  }
  certName = certName ?? config.commonName

  const platform = os.platform()
  const handler = trustStoreHandlers[platform]
  if (!handler?.removeCertificate)
    throw new Error(`uninstallCA: removing certificates is not supported on ${platform}`)

  let removedFromTrustStore = false
  try {
    await handler.removeCertificate(caCertPath, options, certName)
    removedFromTrustStore = true
    log.success(`Root CA "${certName}" removed from the system trust store`)
  }
  catch (err) {
    debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: handler.removeCertificate failed: ${err}`, verbose)
    log.warn(`Could not remove Root CA from trust store: ${(err as Error).message}`)
  }

  let filesDeleted = false
  if (options?.deleteFiles) {
    for (const p of [caCertPath, caKeyPath]) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p)
          debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: deleted ${p}`, verbose)
          filesDeleted = true
        }
      }
      catch (err) {
        debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: failed to delete ${p}: ${err}`, verbose)
      }
    }
    if (filesDeleted)
      log.success('Removed CA cert + key from disk')
  }

  return { removedFromTrustStore, filesDeleted, caCertPath, caKeyPath }
}
