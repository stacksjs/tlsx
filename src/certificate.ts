import type { AddCertOption, CertOption, GenerateCertReturn } from './types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { log, runCommand } from '@stacksjs/cli'
import forge, { pki, tls } from 'node-forge'
import { config } from './config'
import { findFoldersWithFile, makeNumberPositive } from './utils'

/**
 * Generate a random serial number for the Certificate
 * @returns The serial number for the Certificate
 */
export function randomSerialNumber(): string {
  return makeNumberPositive(forge.util.bytesToHex(forge.random.getBytesSync(20)))
}

/**
 * Get the Not Before Date for a Certificate (will be valid from 2 days ago)
 * @returns The Not Before Date for the Certificate
 */
export function getCertNotBefore(): Date {
  const twoDaysAgo = new Date(Date.now() - 60 * 60 * 24 * 2 * 1000)
  const year = twoDaysAgo.getFullYear()
  const month = (twoDaysAgo.getMonth() + 1).toString().padStart(2, '0')
  const day = twoDaysAgo.getDate().toString().padStart(2, '0')
  return new Date(`${year}-${month}-${day}T00:00:00Z`)
}

/**
 * Get the Not After Date for a Certificate (Valid for 90 Days)
 * @param notBefore - The Not Before Date for the Certificate
 * @returns The Not After Date for the Certificate
 */
export function getCertNotAfter(notBefore: Date): Date {
  const ninetyDaysLater = new Date(notBefore.getTime() + 60 * 60 * 24 * 90 * 1000)
  const year = ninetyDaysLater.getFullYear()
  const month = (ninetyDaysLater.getMonth() + 1).toString().padStart(2, '0')
  const day = ninetyDaysLater.getDate().toString().padStart(2, '0')

  return new Date(`${year}-${month}-${day}T23:59:59Z`)
}

/**
 * Get the CA Not After Date (Valid for 100 Years)
 * @param notBefore - The Not Before Date for the CA
 * @returns The Not After Date for the CA
 */
export function getCANotAfter(notBefore: Date): Date {
  const year = notBefore.getFullYear() + 100
  const month = (notBefore.getMonth() + 1).toString().padStart(2, '0')
  const day = notBefore.getDate().toString().padStart(2, '0')

  return new Date(`${year}-${month}-${day}T23:59:59Z`)
}

export const DEFAULT_C = 'US'
export const DEFAULT_ST = 'California'
export const DEFAULT_L = 'Playa Vista'
export const DEFAULT_O: string = config?.organizationName ?? 'stacksjs.org'

/**
 * Create a new Root CA Certificate
 * @returns The Root CA Certificate
 */
export async function createRootCA(): Promise<GenerateCertReturn> {
  // Create a new Keypair for the Root CA
  const { privateKey, publicKey } = pki.rsa.generateKeyPair(2048)

  // Define the attributes for the new Root CA
  const attributes = [
    { shortName: 'C', value: DEFAULT_C },
    { shortName: 'ST', value: DEFAULT_ST },
    { shortName: 'L', value: DEFAULT_L },
    { shortName: 'CN', value: DEFAULT_O },
  ]

  const extensions = [
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true },
  ]

  // Create an empty Certificate
  const caCert = pki.createCertificate()

  // Set the Certificate attributes for the new Root CA
  caCert.publicKey = publicKey
  caCert.serialNumber = randomSerialNumber()
  caCert.validity.notBefore = getCertNotBefore()
  caCert.validity.notAfter = getCANotAfter(caCert.validity.notBefore)
  caCert.setSubject(attributes)
  caCert.setIssuer(attributes)
  caCert.setExtensions(extensions)

  // Self-sign the Certificate
  caCert.sign(privateKey, forge.md.sha512.create())

  // Convert to PEM format
  const pemCert = pki.certificateToPem(caCert)
  const pemKey = pki.privateKeyToPem(privateKey)

  // Return the PEM encoded cert and private key
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
  log.debug('generateCert', options)

  if (!options?.hostCertCN?.trim())
    throw new Error('"hostCertCN" must be a String')
  if (!options.domain?.trim())
    throw new Error('"domain" must be a String')
  if (!options.rootCAObject || !options.rootCAObject.certificate || !options.rootCAObject.privateKey)
    throw new Error('"rootCAObject" must be an Object with the properties "certificate" & "privateKey"')

  // Convert the Root CA PEM details, to a forge Object
  const caCert = pki.certificateFromPem(options.rootCAObject.certificate)
  const caKey = pki.privateKeyFromPem(options.rootCAObject.privateKey)

  // Create a new Keypair for the Host Certificate
  const hostKeys = pki.rsa.generateKeyPair(2048)

  // Define the attributes/properties for the Host Certificate
  const attributes = [
    { shortName: 'C', value: DEFAULT_C },
    { shortName: 'ST', value: DEFAULT_ST },
    { shortName: 'L', value: DEFAULT_L },
    { shortName: 'CN', value: DEFAULT_O },
  ]

  const extensions = [
    { name: 'nsCertType', server: true },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', authorityCertIssuer: true, serialNumber: caCert.serialNumber },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: options.domain }] },
  ]

  // Create an empty Certificate
  const newHostCert = pki.createCertificate()
  newHostCert.publicKey = hostKeys.publicKey

  // Set the attributes for the new Host Certificate
  newHostCert.serialNumber = randomSerialNumber()
  newHostCert.validity.notBefore = getCertNotBefore()
  newHostCert.validity.notAfter = getCertNotAfter(newHostCert.validity.notBefore)
  newHostCert.setSubject(attributes)
  newHostCert.setIssuer(caCert.subject.attributes)
  newHostCert.setExtensions(extensions)

  // Sign the new Host Certificate using the CA
  newHostCert.sign(caKey, forge.md.sha512.create())

  // Convert to PEM format
  const pemHostCert = pki.certificateToPem(newHostCert)
  const pemHostKey = pki.privateKeyToPem(hostKeys.privateKey)

  return {
    certificate: pemHostCert,
    privateKey: pemHostKey,
    notBefore: newHostCert.validity.notBefore,
    notAfter: newHostCert.validity.notAfter,
  }
}

export async function addCertToSystemTrustStoreAndSaveCerts(
  cert: { certificate: string, privateKey: string },
  CAcert: string,
  options?: AddCertOption,
): Promise<string> {
  const certPath = storeCert(cert, options)
  const caCertPath = storeCACert(CAcert, options)

  const platform = os.platform()
  const args = 'TC, C, C'

  if (platform === 'darwin') {
    // macOS
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caCertPath}`,
    )
  }
  else if (platform === 'win32') {
    // Windows
    await runCommand(`certutil -f -v -addstore -enterprise Root ${caCertPath}`)
  }
  else if (platform === 'linux') {
    // Linux (This might vary based on the distro)
    // for Ubuntu/Debian based systems

    const rootDirectory = os.homedir()
    const targetFileName = 'cert9.db'
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    for (const folder of foldersWithFile) {
      try {
        // delete existing cert from system trust store
        await runCommand(`certutil -d sql:${folder} -D -n ${DEFAULT_O}`)
      }
      catch (error) {
        // ignore error if no cert exists
        console.warn(`Error deleting existing cert: ${error}`)
      }

      // add new cert to system trust store
      await runCommand(`certutil -d sql:${folder} -A -t ${args} -n ${DEFAULT_O} -i ${caCertPath}`)

      log.info(`Cert added to ${folder}`)
    }

    // await runCommands([
    //   `sudo cp ${certPath} /usr/local/share/ca-certificates/`,

    //   // add new cert to system trust store
    //   `certutil -d sql:${os.homedir()}/.pki/nssdb -A -t ${args} -n ${DEFAULT_O} -i ${caCertPath}`,

    //   // add new cert to system trust store for Brave
    //   `certutil -d sql:${os.homedir()}/snap/brave/411/.pki/nssdb -A -t ${args} -n ${DEFAULT_O} -i ${caCertPath}`,

    //   // add new cert to system trust store for Firefox
    //   `certutil -d sql:${os.homedir()}/snap/firefox/common/.mozilla/firefox/3l148raz.default -A -t ${args} -n ${DEFAULT_O} -i ${caCertPath}`,

    //   // reload system trust store
    //   `sudo update-ca-certificates`,
    // ]).catch((err) => {
    //   throw new Error(err)
    // })
  }
  else {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  return certPath
}

export function storeCert(cert: { certificate: string, privateKey: string }, options?: AddCertOption): string {
  // Construct the path using os.homedir() and path.join()
  const certPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt`)
  const certKeyPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt.key`)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir))
    fs.mkdirSync(certDir, { recursive: true })

  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the directory exists before writing the file
  const certKeyDir = path.dirname(certKeyPath)
  if (!fs.existsSync(certKeyDir))
    fs.mkdirSync(certKeyDir, { recursive: true })

  fs.writeFileSync(certKeyPath, cert.privateKey)

  return certPath
}

/**
 * Store the CA Certificate
 * @param CAcert - The CA Certificate
 * @param options - The options for storing the CA Certificate
 * @returns The path to the CA Certificate
 */
export function storeCACert(CAcert: string, options?: AddCertOption): string {
  // Construct the path using os.homedir() and path.join()
  const caCertPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.ca.crt`)

  // Ensure the directory exists before writing the file
  const caCertDir = path.dirname(caCertPath)
  if (!fs.existsSync(caCertDir))
    fs.mkdirSync(caCertDir, { recursive: true })

  fs.writeFileSync(caCertPath, CAcert)

  return caCertPath
}

export { forge, pki, tls }
