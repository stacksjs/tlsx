import type { CAOptions, Cert, CertPath, TlsOption } from '../types'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { config } from '../config'
import { CERT_CONSTANTS, LOG_CATEGORIES } from '../constants'
import { debugLog, findFoldersWithFile, log, normalizeCertPaths, runCommand, safeStringify } from '../utils'
import { createRootCA } from './generate'
import { storeCACertificate, storeCertificate } from './store'

/**
 * Check if a certificate is already trusted in the system trust store
 * This helps avoid unnecessary sudo prompts
 */
async function isCertAlreadyTrusted(certPath: string, verbose?: boolean): Promise<boolean> {
  if (os.platform() !== 'darwin') {
    // For non-macOS platforms, return false to let the normal flow proceed
    return false
  }

  try {
    // Get certificate fingerprint
    const certFingerprint = execSync(`openssl x509 -noout -fingerprint -sha256 -in "${certPath}"`).toString().trim()
    const fingerprintValue = certFingerprint.split('=')[1]?.trim() || ''

    if (!fingerprintValue) {
      debugLog(LOG_CATEGORIES.TRUST, 'Could not extract certificate fingerprint', verbose)
      return false
    }

    // Check if the fingerprint exists in the system keychain
    try {
      const keychainOutput = execSync(`security find-certificate -a -Z -p | openssl x509 -noout -fingerprint -sha256 2>/dev/null || true`).toString()

      if (keychainOutput.includes(fingerprintValue)) {
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

// Define platform-specific trust store handlers
interface TrustStoreHandler {
  addCertificate: (caCertPath: string, options?: TlsOption) => Promise<void>
  removeCertificate?: (caCertPath: string, options?: TlsOption, certName?: string) => Promise<void>
  platform: string
}

// macOS trust store handler
const macOSTrustStoreHandler: TrustStoreHandler = {
  platform: 'darwin',
  async addCertificate(caCertPath: string, options?: TlsOption): Promise<void> {
    // Check if already trusted to avoid unnecessary sudo prompts
    const alreadyTrusted = await isCertAlreadyTrusted(caCertPath, options?.verbose)
    if (alreadyTrusted) {
      debugLog(LOG_CATEGORIES.TRUST, 'Certificate is already trusted, skipping trust store update', options?.verbose)
      log.success('Certificate is already trusted in system keychain')
      return
    }

    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to macOS keychain', options?.verbose)
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caCertPath}`,
    )
  },
  async removeCertificate(caCertPath: string, options?: TlsOption, certName?: string): Promise<void> {
    const certificateName = certName || config.commonName
    debugLog(LOG_CATEGORIES.TRUST, `Removing certificate ${certificateName} from macOS keychain`, options?.verbose)
    try {
      await runCommand(
        `sudo security delete-certificate -c "${certificateName}" /Library/Keychains/System.keychain`,
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
  async addCertificate(caCertPath: string, options?: TlsOption): Promise<void> {
    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to Windows certificate store', options?.verbose)
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
  },
  async removeCertificate(caCertPath: string, options?: TlsOption, certName?: string): Promise<void> {
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

// Linux trust store handler
const linuxTrustStoreHandler: TrustStoreHandler = {
  platform: 'linux',
  async addCertificate(caCertPath: string, options?: TlsOption): Promise<void> {
    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to Linux certificate store', options?.verbose)
    const rootDirectory = os.homedir()
    const targetFileName = CERT_CONSTANTS.LINUX_CERT_DB_FILENAME
    const args = CERT_CONSTANTS.LINUX_TRUST_ARGS

    debugLog(LOG_CATEGORIES.TRUST, `Searching for certificate databases in ${rootDirectory}`, options?.verbose)
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    if (foldersWithFile.length === 0) {
      log.warn('No certificate databases found. Certificate may not be trusted by the system.')
      return
    }

    for (const folder of foldersWithFile) {
      debugLog(LOG_CATEGORIES.TRUST, `Processing certificate database in ${folder}`, options?.verbose)
      try {
        debugLog(LOG_CATEGORIES.TRUST, `Attempting to delete existing cert for ${config.commonName}`, options?.verbose)
        await runCommand(`certutil -d sql:${folder} -D -n ${config.commonName}`)
      }
      catch (error) {
        debugLog(LOG_CATEGORIES.TRUST, `Warning: Error deleting existing cert: ${error}`, options?.verbose)
        console.warn(`Error deleting existing cert: ${error}`)
      }

      debugLog(LOG_CATEGORIES.TRUST, `Adding new certificate to ${folder}`, options?.verbose)
      await runCommand(`certutil -d sql:${folder} -A -t ${args} -n ${config.commonName} -i ${caCertPath}`)

      log.info(`Cert added to ${folder}`)
    }
  },
  async removeCertificate(caCertPath: string, options?: TlsOption, certName?: string): Promise<void> {
    const certificateName = certName || config.commonName
    debugLog(LOG_CATEGORIES.TRUST, `Removing certificate ${certificateName} from Linux certificate store`, options?.verbose)
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
export async function addCertToSystemTrustStoreAndSaveCert(cert: Cert, caCert: string, options?: TlsOption): Promise<CertPath> {
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
 * Remove a certificate from the system trust store
 * @param domain - Domain of the certificate to remove
 * @param options - TLS options
 * @param certName - Optional specific certificate name to remove (defaults to config.commonName)
 */
export async function removeCertFromSystemTrustStore(domain: string, options?: TlsOption, certName?: string): Promise<void> {
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

export interface InstallCAOptions extends TlsOption {
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
}

/**
 * mkcert-style "install the local CA" — idempotent. Generates the Root CA on
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

  // The macOS handler already detects "already trusted" via fingerprint match
  // and short-circuits without sudo. We mirror that signal up to callers.
  const alreadyTrusted = await isCertAlreadyTrusted(caCertPath, verbose)
  if (alreadyTrusted) {
    log.success('Root CA is already trusted in the system store')
    return { caCertPath, caKeyPath, generated, trustInstalled: false, alreadyTrusted: true }
  }

  await handler.addCertificate(caCertPath, options)
  log.success('Root CA installed in the system trust store')
  return { caCertPath, caKeyPath, generated, trustInstalled: true, alreadyTrusted: false }
}

export interface UninstallCAOptions extends TlsOption {
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
      const cnLine = execSync(`openssl x509 -noout -subject -in "${caCertPath}"`).toString().trim()
      const m = cnLine.match(/CN\s*=\s*([^,/]+)/)
      certName = m?.[1]?.trim()
      debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: extracted CN from cert: ${certName}`, verbose)
    }
    catch (err) {
      debugLog(LOG_CATEGORIES.TRUST, `uninstallCA: openssl CN extraction failed: ${err}`, verbose)
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
