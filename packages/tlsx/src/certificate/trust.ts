import type { Cert, CertPath, TlsOption } from '../types'
import os from 'node:os'
import { consola as log } from 'consola'
import { config } from '../config'
import { CERT_CONSTANTS, LOG_CATEGORIES } from '../constants'
import { debugLog, findFoldersWithFile, runCommand } from '../utils'
import { storeCACertificate, storeCertificate } from './store'

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
  debugLog(LOG_CATEGORIES.TRUST, `Adding certificate to system trust store with options: ${JSON.stringify(options)}`, options?.verbose)
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
