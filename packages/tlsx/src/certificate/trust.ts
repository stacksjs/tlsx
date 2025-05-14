import os from 'node:os'
import { consola as log } from 'consola'
import type { Cert, CertPath, TlsOption } from '../types'
import { config } from '../config'
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
    debugLog('trust', 'Adding certificate to macOS keychain', options?.verbose)
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caCertPath}`,
    )
  },
}

// Windows trust store handler
const windowsTrustStoreHandler: TrustStoreHandler = {
  platform: 'win32',
  async addCertificate(caCertPath: string, options?: TlsOption): Promise<void> {
    debugLog('trust', 'Adding certificate to Windows certificate store', options?.verbose)
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
  },
}

// Linux trust store handler
const linuxTrustStoreHandler: TrustStoreHandler = {
  platform: 'linux',
  async addCertificate(caCertPath: string, options?: TlsOption): Promise<void> {
    debugLog('trust', 'Adding certificate to Linux certificate store', options?.verbose)
    const rootDirectory = os.homedir()
    const targetFileName = 'cert9.db'
    const args = 'TC, C, C'

    debugLog('trust', `Searching for certificate databases in ${rootDirectory}`, options?.verbose)
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    if (foldersWithFile.length === 0) {
      log.warn('No certificate databases found. Certificate may not be trusted by the system.')
      return
    }

    for (const folder of foldersWithFile) {
      debugLog('trust', `Processing certificate database in ${folder}`, options?.verbose)
      try {
        debugLog('trust', `Attempting to delete existing cert for ${config.commonName}`, options?.verbose)
        await runCommand(`certutil -d sql:${folder} -D -n ${config.commonName}`)
      }
      catch (error) {
        debugLog('trust', `Warning: Error deleting existing cert: ${error}`, options?.verbose)
        console.warn(`Error deleting existing cert: ${error}`)
      }

      debugLog('trust', `Adding new certificate to ${folder}`, options?.verbose)
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
  debugLog('trust', `Adding certificate to system trust store with options: ${JSON.stringify(options)}`, options?.verbose)
  debugLog('trust', 'Storing certificate and private key', options?.verbose)
  const certPath = storeCertificate(cert, options)

  debugLog('trust', 'Storing CA certificate', options?.verbose)
  const caCertPath = storeCACertificate(caCert, options)

  const platform = os.platform()
  debugLog('trust', `Detected platform: ${platform}`, options?.verbose)

  const handler = trustStoreHandlers[platform]
  if (!handler) {
    const errorMsg = `Unsupported platform: ${platform}`
    debugLog('trust', `Error: ${errorMsg}`, options?.verbose)
    throw new Error(errorMsg)
  }

  await handler.addCertificate(caCertPath, options)

  debugLog('trust', 'Certificate successfully added to system trust store', options?.verbose)
  return certPath
}
