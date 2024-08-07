import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { log, runCommand } from '@stacksjs/cli'
import forge, { pki, tls } from 'node-forge'
import { config, resolveConfig } from './config'
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

const DEFAULT_C = 'US'
const DEFAULT_ST = 'California'
const DEFAULT_L = 'Melbourne'
const DEFAULT_O = config.ssl?.organizationName

// Generate a new Root CA Certificate
export async function createRootCA() {
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
      value: config?.ssl?.organizationName,
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

export async function generateCert(options?: GenerateCertOptions) {
  log.debug('generateCert', options)

  if (!options?.hostCertCN.toString().trim()) throw new Error('"hostCertCN" must be a String')
  if (!options.domain.toString().trim()) throw new Error('"domain" must be a String')

  if (!options.rootCAObject || !options.rootCAObject.certificate || !options.rootCAObject.privateKey)
    throw new Error('"rootCAObject" must be an Object with the properties "certificate" & "privateKey"')

  // options should have higher priority than config
  const opts = await resolveConfig(options)

  // Convert the Root CA PEM details, to a forge Object
  const caCert = pki.certificateFromPem(options.rootCAObject.certificate)
  const caKey = pki.privateKeyFromPem(options.rootCAObject.privateKey)

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
      value: config?.ssl?.organizationName,
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
      altNames: [{ type: 2, value: options.domain }],
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

  if (platform === 'darwin') {
    // macOS
    await runCommand(
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CAcertPath}`,
    )
  } else if (platform === 'win32') {
    // Windows
    await runCommand(`certutil -f -v -addstore -enterprise Root ${CAcertPath}`)
  } else if (platform === 'linux') {
    // Linux (This might vary based on the distro)
    // for Ubuntu/Debian based systems

    // return all directories that contain cert9.db file using fs.readdirSync
    function findFoldersWithFile(rootDir: string, fileName: string): string[] {
      const result: string[] = []

      function search(dir: string) {
        try {
          const files = fs.readdirSync(dir)

          for (const file of files) {
            const filePath = path.join(dir, file)
            const stats = fs.lstatSync(filePath) // Use fs.lstatSync instead

            if (stats.isDirectory()) {
              search(filePath)
            } else if (file === fileName) {
              result.push(dir)
            }
          }
        } catch (error) {
          // Handle any errors (e.g., broken links, permission issues)
          console.warn(`Error reading directory ${dir}: ${error}`)
        }
      }

      search(rootDir)
      return result
    }

    //
    const rootDirectory = `${os.homedir()}`
    const targetFileName = 'cert9.db'
    const foldersWithFile = findFoldersWithFile(rootDirectory, targetFileName)

    foldersWithFile.map(async (folder) => {
      // delete existing cert from system trust store
      console.warn = async () => {
        // ignore error if no cert exists
        await runCommand(`certutil -d sql:${folder} -D -n ${DEFAULT_O}`)
      }
      await runCommand(`certutil -d sql:${folder} -A -t ${args} -n ${DEFAULT_O} -i ${CAcertPath}`)

      console.log(folder)
    })

    // await runCommands([
    //   `sudo cp ${certPath} /usr/local/share/ca-certificates/`,

    //   // add new cert to system trust store
    //   `certutil -d sql:${os.homedir()}/.pki/nssdb -A -t ${args} -n ${DEFAULT_O} -i ${CAcertPath}`,

    //   // add new cert to system trust store for Brave
    //   `certutil -d sql:${os.homedir()}/snap/brave/411/.pki/nssdb -A -t ${args} -n ${DEFAULT_O} -i ${CAcertPath}`,

    //   // add new cert to system trust store for Firefox
    //   `certutil -d sql:${os.homedir()}/snap/firefox/common/.mozilla/firefox/3l148raz.default -A -t ${args} -n ${DEFAULT_O} -i ${CAcertPath}`,

    //   // reload system trust store
    //   `sudo update-ca-certificates`,
    // ]).catch((err) => {
    //   throw new Error(err)
    // })
  } else throw new Error(`Unsupported platform: ${platform}`)

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
