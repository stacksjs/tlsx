import os from 'node:os'
import { consola as log } from 'consola'
import type { Cert, CertPath, TlsOption } from '../types'
import { config } from '../config'
import { CERT_CONSTANTS, LOG_CATEGORIES } from '../constants'
import { debugLog, findFoldersWithFile, runCommand } from '../utils'
import { storeCACertificate, storeCertificate } from './store'

// Define platform-specific trust store handlers
interface TrustStoreHandler {
  addCertificate(caCertPath: string, options?: TlsOption): Promise<void>
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
}

// Windows trust store handler
const windowsTrustStoreHandler: TrustStoreHandler = {
  platform: 'win32',
  async addCertificate(caCertPath: string, options?: TlsOption): Promise<void> {
    debugLog(LOG_CATEGORIES.TRUST, 'Adding certificate to Windows certificate store', options?.verbose)
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
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
