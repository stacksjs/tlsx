import type { CertOption, GenerateCertReturn, TlsOption } from './types'
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
export function randomSerialNumber(verbose?: boolean): string {
  debugLog('cert', 'Generating random serial number', verbose)
  const serialNumber = makeNumberPositive(forge.util.bytesToHex(forge.random.getBytesSync(20)))
  debugLog('cert', `Generated serial number: ${serialNumber}`, verbose)
  return serialNumber
}

/**
 * Get the Not Before Date for a Certificate (will be valid from 2 days ago)
 * @returns The Not Before Date for the Certificate
 */
export function getCertNotBefore(verbose?: boolean): Date {
  debugLog('cert', 'Calculating certificate not-before date', verbose)
  const twoDaysAgo = new Date(Date.now() - 60 * 60 * 24 * 2 * 1000)
  const year = twoDaysAgo.getFullYear()
  const month = (twoDaysAgo.getMonth() + 1).toString().padStart(2, '0')
  const day = twoDaysAgo.getDate().toString().padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}T23:59:59Z`)
  debugLog('cert', `Certificate not-before date: ${date.toISOString()}`, verbose)
  return date
}

/**
 * Get the Not After Date for a Certificate (Valid for 90 Days)
 * @param notBefore - The Not Before Date for the Certificate
 * @returns The Not After Date for the Certificate
 */
export function getCertNotAfter(notBefore: Date, verbose?: boolean): Date {
  debugLog('cert', 'Calculating certificate not-after date', verbose)
  const validityDays = config.validityDays // defaults to 180 days
  const daysInMillis = validityDays * 60 * 60 * 24 * 1000
  const notAfterDate = new Date(notBefore.getTime() + daysInMillis)
  const year = notAfterDate.getFullYear()
  const month = (notAfterDate.getMonth() + 1).toString().padStart(2, '0')
  const day = notAfterDate.getDate().toString().padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}T23:59:59Z`)
  debugLog('cert', `Certificate not-after date: ${date.toISOString()} (${validityDays} days validity)`, verbose)
  return date
}

/**
 * Get the CA Not After Date (Valid for 100 Years)
 * @param notBefore - The Not Before Date for the CA
 * @returns The Not After Date for the CA
 */
export function getCANotAfter(notBefore: Date, verbose?: boolean): Date {
  debugLog('cert', 'Calculating CA not-after date', verbose)
  const year = notBefore.getFullYear() + 100
  const month = (notBefore.getMonth() + 1).toString().padStart(2, '0')
  const day = notBefore.getDate().toString().padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}T23:59:59Z`)
  debugLog('cert', `CA not-after date: ${date.toISOString()} (100 years validity)`, verbose)
  return date
}

/**
 * Create a new Root CA Certificate
 * @returns The Root CA Certificate
 */
export async function createRootCA(options?: TlsOption): Promise<GenerateCertReturn> {
  debugLog('ca', 'Creating new Root CA Certificate', options?.verbose)
  debugLog('ca', 'Generating 2048-bit RSA key pair', options?.verbose)
  const { privateKey, publicKey } = pki.rsa.generateKeyPair(2048)

  const mergedOptions = {
    ...config,
    ...(options || {}),
  }

  debugLog('ca', 'Setting certificate attributes', options?.verbose)
  const attributes = [
    { shortName: 'C', value: mergedOptions.countryName },
    { shortName: 'ST', value: mergedOptions.stateName },
    { shortName: 'L', value: mergedOptions.localityName },
    { shortName: 'O', value: 'Local Development CA' },
    { shortName: 'CN', value: 'Local Development Root CA' },
  ]

  debugLog('ca', 'Setting certificate extensions', options?.verbose)
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

  debugLog('ca', 'Creating CA certificate', options?.verbose)
  const caCert = pki.createCertificate()
  caCert.publicKey = publicKey
  caCert.serialNumber = randomSerialNumber(options?.verbose)
  caCert.validity.notBefore = getCertNotBefore(options?.verbose)
  caCert.validity.notAfter = getCANotAfter(caCert.validity.notBefore, options?.verbose)
  caCert.setSubject(attributes)
  caCert.setIssuer(attributes)
  caCert.setExtensions(extensions)

  debugLog('ca', 'Signing certificate with SHA-256', options?.verbose)
  caCert.sign(privateKey, forge.md.sha256.create())

  const pemCert = pki.certificateToPem(caCert)
  const pemKey = pki.privateKeyToPem(privateKey)

  debugLog('ca', 'Root CA Certificate created successfully', options?.verbose)
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
  debugLog('cert', 'Generating new host certificate', options?.verbose)
  debugLog('cert', `Options: ${JSON.stringify(options)}`, options?.verbose)

  if (!options?.hostCertCN?.trim()) {
    debugLog('cert', 'Error: hostCertCN is required', options?.verbose)
    throw new Error('"hostCertCN" must be a String')
  }
  if (!options.domain?.trim()) {
    debugLog('cert', 'Error: domain is required', options?.verbose)
    throw new Error('"domain" must be a String')
  }
  if (!options.rootCAObject || !options.rootCAObject.certificate || !options.rootCAObject.privateKey) {
    debugLog('cert', 'Error: rootCAObject is invalid or missing', options?.verbose)
    throw new Error('"rootCAObject" must be an Object with the properties "certificate" & "privateKey"')
  }

  debugLog('cert', 'Converting Root CA PEM to forge objects', options?.verbose)
  const caCert = pki.certificateFromPem(options.rootCAObject.certificate)
  const caKey = pki.privateKeyFromPem(options.rootCAObject.privateKey)

  debugLog('cert', 'Generating 2048-bit RSA key pair for host certificate', options?.verbose)
  const hostKeys = pki.rsa.generateKeyPair(2048)

  debugLog('cert', 'Setting certificate attributes', options?.verbose)
  const attributes = [
    { shortName: 'C', value: config.countryName },
    { shortName: 'ST', value: config.stateName },
    { shortName: 'L', value: config.localityName },
    { shortName: 'O', value: 'Local Development' },
    { shortName: 'CN', value: '*.localhost' },
  ]

  debugLog('cert', 'Setting certificate extensions', options?.verbose)
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

  debugLog('cert', 'Creating new host certificate', options?.verbose)
  const newHostCert = pki.createCertificate()
  newHostCert.publicKey = hostKeys.publicKey

  debugLog('cert', 'Setting certificate properties', options?.verbose)
  newHostCert.serialNumber = randomSerialNumber(options?.verbose)
  newHostCert.validity.notBefore = getCertNotBefore(options?.verbose)
  newHostCert.validity.notAfter = getCertNotAfter(newHostCert.validity.notBefore, options?.verbose)
  newHostCert.setSubject(attributes)
  newHostCert.setIssuer(caCert.subject.attributes)
  newHostCert.setExtensions(extensions)

  debugLog('cert', 'Signing certificate with SHA-256', options?.verbose)
  newHostCert.sign(caKey, forge.md.sha256.create())

  debugLog('cert', 'Converting certificate to PEM format', options?.verbose)
  const pemHostCert = pki.certificateToPem(newHostCert)
  const pemHostKey = pki.privateKeyToPem(hostKeys.privateKey)

  debugLog('cert', 'Host certificate generated successfully', options?.verbose)
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
export async function addCertToSystemTrustStoreAndSaveCert(cert: Cert, caCert: string, options?: TlsOption): Promise<string> {
  debugLog('trust', `Adding certificate to system trust store with options: ${JSON.stringify(options)}`, options?.verbose)
  debugLog('trust', 'Storing certificate and private key', options?.verbose)
  const certPath = storeCert(cert, options)

  debugLog('trust', 'Storing CA certificate', options?.verbose)
  const caCertPath = storeCACert(caCert, options)

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

export function storeCert(cert: Cert, options?: TlsOption): string {
  debugLog('storage', 'Storing certificate and private key', options?.verbose)
  const certPath = options?.certPath || config.certPath
  const certKeyPath = options?.keyPath || config.keyPath

  debugLog('storage', `Certificate path: ${certPath}`, options?.verbose)
  debugLog('storage', `Private key path: ${certKeyPath}`, options?.verbose)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) {
    debugLog('storage', `Creating certificate directory: ${certDir}`, options?.verbose)
    fs.mkdirSync(certDir, { recursive: true })
  }

  debugLog('storage', 'Writing certificate file', options?.verbose)
  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the directory exists before writing the file
  const certKeyDir = path.dirname(certKeyPath)
  if (!fs.existsSync(certKeyDir)) {
    debugLog('storage', `Creating private key directory: ${certKeyDir}`, options?.verbose)
    fs.mkdirSync(certKeyDir, { recursive: true })
  }

  debugLog('storage', 'Writing private key file', options?.verbose)
  fs.writeFileSync(certKeyPath, cert.privateKey)

  debugLog('storage', 'Certificate and private key stored successfully', options?.verbose)
  return certPath
}

/**
 * Store the CA Certificate
 * @param caCert - The CA Certificate
 * @param options - The options for storing the CA Certificate
 * @returns The path to the CA Certificate
 */
export function storeCACert(caCert: string, options?: AddCertOption): string {
  debugLog('storage', 'Storing CA certificate', options?.verbose)
  const caCertPath = options?.customCertPath || config.caCertPath

  debugLog('storage', `CA certificate path: ${caCertPath}`, options?.verbose)

  // Ensure the directory exists before writing the file
  const caCertDir = path.dirname(caCertPath)
  if (!fs.existsSync(caCertDir)) {
    debugLog('storage', `Creating CA certificate directory: ${caCertDir}`, options?.verbose)
    fs.mkdirSync(caCertDir, { recursive: true })
  }

  debugLog('storage', 'Writing CA certificate file', options?.verbose)
  fs.writeFileSync(caCertPath, caCert)

  debugLog('storage', 'CA certificate stored successfully', options?.verbose)
  return caCertPath
}

export { forge, pki, tls }
