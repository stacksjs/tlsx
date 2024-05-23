import dns from 'node:dns'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Readable, Writable } from 'node:stream'
import { exec, log, runCommand, runCommands } from '@stacksjs/cli'
import forge, { pki, tls } from 'node-forge'
import { resolveConfig } from './config'
import type { GenerateCertOptions } from './types'

const makeNumberPositive = (hexString: string) => {
  let mostSignificativeHexDigitAsInt = Number.parseInt(hexString[0], 16)

  if (mostSignificativeHexDigitAsInt < 8) return hexString

  mostSignificativeHexDigitAsInt -= 8
  return mostSignificativeHexDigitAsInt.toString() + hexString.substring(1)
}

// Generate a random serial number for the Certificate
const randomSerialNumber = () => {
  return makeNumberPositive(forge.util.bytesToHex(forge.random.getBytesSync(20)))
}

// Get the Not Before Date for a Certificate (will be valid from 2 days ago)
const getCertNotBefore = () => {
  const twoDaysAgo = new Date(Date.now() - 60 * 60 * 24 * 2 * 1000)
  const year = twoDaysAgo.getFullYear()
  const month = (twoDaysAgo.getMonth() + 1).toString().padStart(2, '0')
  const day = twoDaysAgo.getDate()
  return new Date(`${year}-${month}-${day} 00:00:00Z`)
}

// Get Certificate Expiration Date (Valid for 90 Days)
const getCertNotAfter = (notBefore: any) => {
  const ninetyDaysLater = new Date(notBefore.getTime() + 60 * 60 * 24 * 90 * 1000)
  const year = ninetyDaysLater.getFullYear()
  const month = (ninetyDaysLater.getMonth() + 1).toString().padStart(2, '0')
  const day = ninetyDaysLater.getDate()
  return new Date(`${year}-${month}-${day} 23:59:59Z`)
}

// Get CA Expiration Date (Valid for 100 Years)
const getCANotAfter = (notBefore: any) => {
  const year = notBefore.getFullYear() + 100
  const month = (notBefore.getMonth() + 1).toString().padStart(2, '0')
  const day = notBefore.getDate()
  return new Date(`${year}-${month}-${day} 23:59:59Z`)
}

// Function to check if a certificate file has expired
export const isCertificateExpired = async (certFilePath: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {

    try {
        // Check if the file exists
        if (!fs.existsSync(certFilePath)) {
          reject('Certificate not found')
        }
        
      // Read the certificate file
      const certData = fs.readFileSync(certFilePath, 'utf8')

    

      // check if cert exists
      if (!certData) {
        reject('Certificate not found')
      }
      // Parse the certificate data
      const cert = forge.pki.certificateFromPem(certData)

      // Get the expiry date of the certificate
      const expiryDate = cert.validity.notAfter

      // Check if the certificate has expired
      const isExpired = expiryDate < new Date()

      resolve(isExpired)

    } catch (error) {
      // Handle errors
      console.error(`Error checking certificate expiry: ${error}`)
      // reject(error) // Reject the promise with the error
    }
  })
}

// Function to check if a domain exists in the certificate
export const isDomainExists = async (domainToCheck: string, certificatePath: string) => {
  // Read the certificate file
  const certificateContents = fs.readFileSync(certificatePath, 'utf8')

  
  if(!certificateContents) {
  
    throw new Error('Certificate not found')
  }

  // Parse the certificate data
  const certificate = forge.pki.certificateFromPem(certificateContents)

  // Get the alt name of the certificate
  const subject = certificate.extensions

  // Check if the domain exists in the alt name
  const altName = subject.find((attr: any) => attr.name === 'subjectAltName')

  // Extract the domain from the alt name
  const extractedValue = altName.altNames[0]?.value

  if (extractedValue && extractedValue === domainToCheck) {
    console.log(`Domain ${domainToCheck} exists in the certificate.`)
    return true
  }

  return false
}

const DEFAULT_C = 'US'
const DEFAULT_ST = 'California'
const DEFAULT_L = 'Melbourne'
const DEFAULT_O = 'Tlsx Stacks RootCA'

// Generate a new Root CA Certificate
export async function CreateRootCA() {
  // Create a new Keypair for the Root CA
  const { privateKey, publicKey } = pki.rsa.generateKeyPair(2048)

  // Define the attributes for the new Root CA
  const attributes = [
    {
      shortName: 'C',
      value: DEFAULT_C,
    },
    {
      shortName: 'ST',
      value: DEFAULT_ST,
    },
    {
      shortName: 'L',
      value: DEFAULT_L,
    },
    {
      shortName: 'CN',
      value: DEFAULT_O,
    },
  ]

  const extensions = [
    {
      name: 'basicConstraints',
      cA: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      cRLSign: true,
    },
  ]

  // Create an empty Certificate
  const CAcert = pki.createCertificate()

  // Set the Certificate attributes for the new Root CA
  CAcert.publicKey = publicKey
  CAcert.privateKey = privateKey
  CAcert.serialNumber = randomSerialNumber()
  CAcert.validity.notBefore = getCertNotBefore()
  CAcert.validity.notAfter = getCANotAfter(CAcert.validity.notBefore)
  CAcert.setSubject(attributes)
  CAcert.setIssuer(attributes)
  CAcert.setExtensions(extensions)

  // Self-sign the Certificate
  CAcert.sign(privateKey, forge.md.sha512.create())

  // Convert to PEM format
  const pemCert = pki.certificateToPem(CAcert)
  const pemKey = pki.privateKeyToPem(privateKey)

  // Return the PEM encoded cert and private key
  return {
    certificate: pemCert,
    privateKey: pemKey,
    notBefore: CAcert.validity.notBefore,
    notAfter: CAcert.validity.notAfter,
  }
}

export async function generateCert(
  hostCertCN: string,
  domain: string,
  rootCAObject: { certificate: string; privateKey: string },
  options?: GenerateCertOptions,
) {
  log.debug('generateCert', options)

  if (!hostCertCN.toString().trim()) throw new Error('"hostCertCN" must be a String')
  if (!domain.toString().trim()) throw new Error('"validDomain" must be a String')

  if (!rootCAObject || !rootCAObject.certificate || !rootCAObject.privateKey)
    throw new Error('"rootCAObject" must be an Object with the properties "certificate" & "privateKey"')

  const opts = await resolveConfig(options)
  // Convert the Root CA PEM details, to a forge Object
  const caCert = pki.certificateFromPem(rootCAObject.certificate)
  const caKey = pki.privateKeyFromPem(rootCAObject.privateKey)

  // Create a new Keypair for the Host Certificate
  const hostKeys = pki.rsa.generateKeyPair(2048)
  // Define the attributes/properties for the Host Certificate
  const attributes = [
    {
      shortName: 'C',
      value: DEFAULT_C,
    },
    {
      shortName: 'ST',
      value: DEFAULT_ST,
    },
    {
      shortName: 'L',
      value: DEFAULT_L,
    },
    {
      shortName: 'CN',
      value: hostCertCN,
    },
  ]

  const extensions = [
    {
      name: 'nsCertType',
      server: true,
    },
    {
      name: 'subjectKeyIdentifier',
    },
    {
      name: 'authorityKeyIdentifier',
      authorityCertIssuer: true,
      serialNumber: caCert.serialNumber,
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
    },
    {
      name: 'subjectAltName',
      altNames: [{ type: 2, value: domain }],
    },
  ]

  // Create an empty Certificate
  const newHostCert = pki.createCertificate()
  newHostCert.publicKey = hostKeys.publicKey

  // Set the attributes for the new Host Certificate
  newHostCert.publicKey = hostKeys.publicKey
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
  }
}

export interface AddCertOptions {
  customCertPath?: string
}

export async function addCertToSystemTrustStoreAndSaveCerts(
  cert: { certificate: string; privateKey: string },
  CAcert: string,
  options?: AddCertOptions,
) {
  const certPath = storeCert(cert, options)
  const CAcertPath = storeCACert(CAcert, options)

  const platform = os.platform()
  const args = 'TC, C, C'

  if (platform === 'darwin')
    // macOS
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CAcertPath}`,
    )
  else if (platform === 'win32')
    // Windows
    await runCommand(`certutil -f -v -addstore -enterprise Root ${CAcertPath}`)
  else if (platform === 'linux')
    // Linux (This might vary based on the distro)
    // for Ubuntu/Debian based systems
    await runCommands([
      `sudo cp ${certPath} /usr/local/share/ca-certificates/`,

      `certutil -d sql:${os.homedir()}/.pki/nssdb -A -t ${args} -n ${DEFAULT_O} -i ${CAcertPath}`,

      `certutil -d sql:${os.homedir()}/snap/firefox/common/.mozilla/firefox/3l148raz.default -A -t ${args} -n ${DEFAULT_O} -i ${CAcertPath}`,

      `sudo update-ca-certificates`,
    ])
  else throw new Error(`Unsupported platform: ${platform}`)

  return certPath
}

export function storeCert(cert: { certificate: string; privateKey: string }, options?: AddCertOptions) {
  // Construct the path using os.homedir() and path.join()
  const certPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`)

  const certKeyPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true })
  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the directory exists before writing the file
  const certKeyDir = path.dirname(certKeyPath)
  if (!fs.existsSync(certKeyDir)) fs.mkdirSync(certKeyDir, { recursive: true })

  fs.writeFileSync(certKeyPath, cert.privateKey)

  return certPath
}

export function storeCACert(CAcert: string, options?: AddCertOptions) {
  // Construct the path using os.homedir() and path.join()
  const CAcertPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`)

  // Ensure the directory exists before writing the file
  const CacertDir = path.dirname(CAcertPath)
  if (!fs.existsSync(CacertDir)) fs.mkdirSync(CacertDir, { recursive: true })

  fs.writeFileSync(CAcertPath, CAcert)

  return CAcertPath
}

export { tls, pki, forge }
