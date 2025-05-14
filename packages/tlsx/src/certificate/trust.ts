import os from 'node:os'
import { consola as log } from 'consola'
import type { Cert, CertPath, TlsOption } from '../types'
import { config } from '../config'
import { debugLog, findFoldersWithFile, runCommand } from '../utils'
import { storeCACertificate, storeCertificate } from './store'

/**
 * Add a certificate to the system trust store and save the certificate to a file
 * @param cert
 * @param caCert
 * @param options
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
  const args = 'TC, C, C'

  if (platform === 'darwin') {
    debugLog('trust', 'Adding certificate to macOS keychain', options?.verbose)
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caCertPath}`,
    )
  }
  else if (platform === 'win32') {
    debugLog('trust', 'Adding certificate to Windows certificate store', options?.verbose)
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
  }
  else if (platform === 'linux') {
    debugLog('trust', 'Adding certificate to Linux certificate store', options?.verbose)
    const rootDirectory = os.homedir()
    const targetFileName = 'cert9.db'
    debugLog('trust', `Searching for certificate databases in ${rootDirectory}`, options?.verbose)
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

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
  }
  else {
    debugLog('trust', `Error: Unsupported platform ${platform}`, options?.verbose)
    throw new Error(`Unsupported platform: ${platform}`)
  }

  debugLog('trust', 'Certificate successfully added to system trust store', options?.verbose)
  return certPath
}
