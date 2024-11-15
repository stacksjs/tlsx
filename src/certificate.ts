import type { AddCertOption, CertOption, GenerateCertReturn, TlsOption } from './types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { log, runCommand } from '@stacksjs/cli'
import forge, { pki, tls } from 'node-forge'
import { config } from './config'
import { debugLog, findFoldersWithFile, makeNumberPositive } from './utils'

export interface Cert {
  certificate: string
  privateKey: string
}

/**
 * Generate a random serial number for the Certificate
 * @returns The serial number for the Certificate
 */
export function randomSerialNumber(): string {
  debugLog('cert', 'Generating random serial number')
  const serialNumber = makeNumberPositive(forge.util.bytesToHex(forge.random.getBytesSync(20)))
  debugLog('cert', `Generated serial number: ${serialNumber}`)
  return serialNumber
}

/**
 * Get the Not Before Date for a Certificate (will be valid from 2 days ago)
 * @returns The Not Before Date for the Certificate
 */
export function getCertNotBefore(): Date {
  debugLog('cert', 'Calculating certificate not-before date')
  const twoDaysAgo = new Date(Date.now() - 60 * 60 * 24 * 2 * 1000)
  const year = twoDaysAgo.getFullYear()
  const month = (twoDaysAgo.getMonth() + 1).toString().padStart(2, '0')
  const day = twoDaysAgo.getDate().toString().padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}T23:59:59Z`)
  debugLog('cert', `Certificate not-before date: ${date.toISOString()}`)
  return date
}

/**
 * Get the Not After Date for a Certificate (Valid for 90 Days)
 * @param notBefore - The Not Before Date for the Certificate
 * @returns The Not After Date for the Certificate
 */
export function getCertNotAfter(notBefore: Date): Date {
  debugLog('cert', 'Calculating certificate not-after date')
  const validityDays = config.validityDays // defaults to 180 days
  const daysInMillis = validityDays * 60 * 60 * 24 * 1000
  const notAfterDate = new Date(notBefore.getTime() + daysInMillis)
  const year = notAfterDate.getFullYear()
  const month = (notAfterDate.getMonth() + 1).toString().padStart(2, '0')
  const day = notAfterDate.getDate().toString().padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}T23:59:59Z`)
  debugLog('cert', `Certificate not-after date: ${date.toISOString()} (${validityDays} days validity)`)
  return date
}

/**
 * Get the CA Not After Date (Valid for 100 Years)
 * @param notBefore - The Not Before Date for the CA
 * @returns The Not After Date for the CA
 */
export function getCANotAfter(notBefore: Date): Date {
  debugLog('cert', 'Calculating CA not-after date')
  const year = notBefore.getFullYear() + 100
  const month = (notBefore.getMonth() + 1).toString().padStart(2, '0')
  const day = notBefore.getDate().toString().padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}T23:59:59Z`)
  debugLog('cert', `CA not-after date: ${date.toISOString()} (100 years validity)`)
  return date
}

/**
 * Create a new Root CA Certificate
 * @returns The Root CA Certificate
 */
export async function createRootCA(options?: TlsOption): Promise<GenerateCertReturn> {
  debugLog('ca', 'Creating new Root CA Certificate')
  debugLog('ca', 'Generating 2048-bit RSA key pair')
  const { privateKey, publicKey } = pki.rsa.generateKeyPair(2048)

  const mergedOptions = {
    ...config,
    ...(options || {}),
  }

  debugLog('ca', 'Setting certificate attributes')
  const attributes = [
    { shortName: 'C', value: mergedOptions.countryName },
    { shortName: 'ST', value: mergedOptions.stateName },
    { shortName: 'L', value: mergedOptions.localityName },
    { shortName: 'O', value: 'Local Development CA' },
    { shortName: 'CN', value: 'Local Development Root CA' },
  ]

  debugLog('ca', 'Setting certificate extensions')
  const extensions = [
    {
      name: 'basicConstraints',
      cA: true,
      critical: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      cRLSign: true,
      critical: true,
    },
    {
      name: 'subjectKeyIdentifier',
    },
  ]

  debugLog('ca', 'Creating CA certificate')
  const caCert = pki.createCertificate()
  caCert.publicKey = publicKey
  caCert.serialNumber = randomSerialNumber()
  caCert.validity.notBefore = getCertNotBefore()
  caCert.validity.notAfter = getCANotAfter(caCert.validity.notBefore)
  caCert.setSubject(attributes)
  caCert.setIssuer(attributes)
  caCert.setExtensions(extensions)

  debugLog('ca', 'Signing certificate with SHA-256')
  caCert.sign(privateKey, forge.md.sha256.create())

  const pemCert = pki.certificateToPem(caCert)
  const pemKey = pki.privateKeyToPem(privateKey)

  debugLog('ca', 'Root CA Certificate created successfully')
  return {
    certificate: pemCert,
    privateKey: pemKey,
    notBefore: caCert.validity.notBefore,
    notAfter: caCert.validity.notAfter,
  }
}

/**
 * Generate a new Host Certificate
 * @param options - The options for generating the certificate
 * @returns The generated certificate
 */
export async function generateCert(options?: CertOption): Promise<GenerateCertReturn> {
  debugLog('cert', 'Generating new host certificate')
  debugLog('cert', `Options: ${JSON.stringify(options)}`)

  if (!options?.hostCertCN?.trim()) {
    debugLog('cert', 'Error: hostCertCN is required')
    throw new Error('"hostCertCN" must be a String')
  }
  if (!options.domain?.trim()) {
    debugLog('cert', 'Error: domain is required')
    throw new Error('"domain" must be a String')
  }
  if (!options.rootCAObject || !options.rootCAObject.certificate || !options.rootCAObject.privateKey) {
    debugLog('cert', 'Error: rootCAObject is invalid or missing')
    throw new Error('"rootCAObject" must be an Object with the properties "certificate" & "privateKey"')
  }

  debugLog('cert', 'Converting Root CA PEM to forge objects')
  const caCert = pki.certificateFromPem(options.rootCAObject.certificate)
  const caKey = pki.privateKeyFromPem(options.rootCAObject.privateKey)

  debugLog('cert', 'Generating 2048-bit RSA key pair for host certificate')
  const hostKeys = pki.rsa.generateKeyPair(2048)

  debugLog('cert', 'Setting certificate attributes')
  const attributes = [
    { shortName: 'C', value: config.countryName },
    { shortName: 'ST', value: config.stateName },
    { shortName: 'L', value: config.localityName },
    { shortName: 'O', value: 'Local Development' },
    { shortName: 'CN', value: '*.localhost' },
  ]

  debugLog('cert', 'Setting certificate extensions')
  const extensions = [
    {
      name: 'basicConstraints',
      cA: false,
      critical: true,
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: false,
    },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: '*.localhost' },
        { type: 2, value: 'localhost' },
        { type: 2, value: 'stacks.localhost' },
        { type: 2, value: options.domain },
      ],
    },
  ]

  debugLog('cert', 'Creating new host certificate')
  const newHostCert = pki.createCertificate()
  newHostCert.publicKey = hostKeys.publicKey

  debugLog('cert', 'Setting certificate properties')
  newHostCert.serialNumber = randomSerialNumber()
  newHostCert.validity.notBefore = getCertNotBefore()
  newHostCert.validity.notAfter = getCertNotAfter(newHostCert.validity.notBefore)
  newHostCert.setSubject(attributes)
  newHostCert.setIssuer(caCert.subject.attributes)
  newHostCert.setExtensions(extensions)

  debugLog('cert', 'Signing certificate with SHA-256')
  newHostCert.sign(caKey, forge.md.sha256.create())

  debugLog('cert', 'Converting certificate to PEM format')
  const pemHostCert = pki.certificateToPem(newHostCert)
  const pemHostKey = pki.privateKeyToPem(hostKeys.privateKey)

  debugLog('cert', 'Host certificate generated successfully')
  return {
    certificate: pemHostCert,
    privateKey: pemHostKey,
    notBefore: newHostCert.validity.notBefore,
    notAfter: newHostCert.validity.notAfter,
  }
}

/**
 * Add a certificate to the system trust store and save the certificate to a file
 * @param cert
 * @param caCert
 * @param options
 * @returns The path to the stored certificate
 */
export async function addCertToSystemTrustStoreAndSaveCert(cert: Cert, caCert: string, options?: AddCertOption): Promise<string> {
  debugLog('trust', 'Adding certificate to system trust store')

  debugLog('trust', 'Storing certificate and private key')
  const certPath = storeCert(cert, options)

  debugLog('trust', 'Storing CA certificate')
  const caCertPath = storeCACert(caCert, options)

  const platform = os.platform()
  debugLog('trust', `Detected platform: ${platform}`)
  const args = 'TC, C, C'

  if (platform === 'darwin') {
    debugLog('trust', 'Adding certificate to macOS keychain')
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caCertPath}`,
    )
  }
  else if (platform === 'win32') {
    debugLog('trust', 'Adding certificate to Windows certificate store')
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
  }
  else if (platform === 'linux') {
    debugLog('trust', 'Adding certificate to Linux certificate store')
    const rootDirectory = os.homedir()
    const targetFileName = 'cert9.db'
    debugLog('trust', `Searching for certificate databases in ${rootDirectory}`)
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    for (const folder of foldersWithFile) {
      debugLog('trust', `Processing certificate database in ${folder}`)
      try {
        debugLog('trust', `Attempting to delete existing cert for ${config.commonName}`)
        await runCommand(`certutil -d sql:${folder} -D -n ${config.commonName}`)
      }
      catch (error) {
        debugLog('trust', `Warning: Error deleting existing cert: ${error}`)
        console.warn(`Error deleting existing cert: ${error}`)
      }

      debugLog('trust', `Adding new certificate to ${folder}`)
      await runCommand(`certutil -d sql:${folder} -A -t ${args} -n ${config.commonName} -i ${caCertPath}`)

      log.info(`Cert added to ${folder}`)
    }
  }
  else {
    debugLog('trust', `Error: Unsupported platform ${platform}`)
    throw new Error(`Unsupported platform: ${platform}`)
  }

  debugLog('trust', 'Certificate successfully added to system trust store')
  return certPath
}

export function storeCert(cert: Cert, options?: AddCertOption): string {
  debugLog('storage', 'Storing certificate and private key')
  const certPath = options?.customCertPath || config.certPath
  const certKeyPath = options?.customCertPath || config.keyPath

  debugLog('storage', `Certificate path: ${certPath}`)
  debugLog('storage', `Private key path: ${certKeyPath}`)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) {
    debugLog('storage', `Creating certificate directory: ${certDir}`)
    fs.mkdirSync(certDir, { recursive: true })
  }

  debugLog('storage', 'Writing certificate file')
  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the directory exists before writing the file
  const certKeyDir = path.dirname(certKeyPath)
  if (!fs.existsSync(certKeyDir)) {
    debugLog('storage', `Creating private key directory: ${certKeyDir}`)
    fs.mkdirSync(certKeyDir, { recursive: true })
  }

  debugLog('storage', 'Writing private key file')
  fs.writeFileSync(certKeyPath, cert.privateKey)

  debugLog('storage', 'Certificate and private key stored successfully')
  return certPath
}

/**
 * Store the CA Certificate
 * @param caCert - The CA Certificate
 * @param options - The options for storing the CA Certificate
 * @returns The path to the CA Certificate
 */
export function storeCACert(caCert: string, options?: AddCertOption): string {
  debugLog('storage', 'Storing CA certificate')
  const caCertPath = options?.customCertPath || config.caCertPath

  debugLog('storage', `CA certificate path: ${caCertPath}`)

  // Ensure the directory exists before writing the file
  const caCertDir = path.dirname(caCertPath)
  if (!fs.existsSync(caCertDir)) {
    debugLog('storage', `Creating CA certificate directory: ${caCertDir}`)
    fs.mkdirSync(caCertDir, { recursive: true })
  }

  debugLog('storage', 'Writing CA certificate file')
  fs.writeFileSync(caCertPath, caCert)

  debugLog('storage', 'CA certificate stored successfully')
  return caCertPath
}

export { forge, pki, tls }
