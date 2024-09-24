import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pki } from 'node-forge'

/**
 * Checks if a certificate is valid for a given domain.
 * @param certPath - Path to the certificate file.
 * @param domain - The domain to check.
 * @returns {boolean} - True if the certificate is valid for the domain, false otherwise.
 */
export function isCertValidForDomain(certPath: string, domain: string): boolean {
  const certPem = fs.readFileSync(certPath, 'utf8')
  const cert = pki.certificateFromPem(certPem)
  const altNames = cert.getExtension('subjectAltName')

  if (altNames) {
    for (const altName of altNames.altNames) {
      if (altName.value === domain) {
        return true
      }
    }
  }

  return cert.subject.getField('CN').value === domain
}

/**
 * Reads a certificate from a file.
 * @param certPath - Path to the certificate file.
 * @returns {string} - The certificate content.
 */
export function readCertFromFile(certPath: string): string {
  return fs.readFileSync(certPath, 'utf8')
}

/**
 * Parses and extracts details from a certificate.
 * @param certPem - The certificate in PEM format.
 * @returns {object} - An object containing certificate details.
 */
export function parseCertDetails(certPem: string) {
  const cert = pki.certificateFromPem(certPem)
  return {
    subject: cert.subject.attributes,
    issuer: cert.issuer.attributes,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
    serialNumber: cert.serialNumber,
  }
}

/**
 * Checks if a certificate is expired.
 * @param certPem - The certificate in PEM format.
 * @returns {boolean} - True if the certificate is expired, false otherwise.
 */
export function isCertExpired(certPem: string): boolean {
  const cert = pki.certificateFromPem(certPem)
  const now = new Date()
  return now > cert.validity.notAfter
}

/**
 * Lists all certificates in a directory.
 * By default, it returns the certificates stored in their default locations on each operating system.
 * If no certificates are found in the default paths, it checks the fallback path.
 * @param dirPath - Path to the directory. If not provided, the default directory for the OS will be used.
 * @returns {string[]} - An array of certificate file paths.
 */
export function listCertsInDirectory(dirPath?: string): string[] {
  const platform = os.platform()
  let defaultDir: string

  if (!dirPath) {
    if (platform === 'darwin') {
      // macOS default certificate directory
      defaultDir = '/etc/ssl/certs'
    } else if (platform === 'win32') {
      // Windows default certificate directory
      defaultDir = 'C:\\Windows\\System32\\certsrv\\CertEnroll'
    } else if (platform === 'linux') {
      // Linux default certificate directory
      defaultDir = '/etc/ssl/certs'
    } else {
      throw new Error(`Unsupported platform: ${platform}`)
    }
  } else {
    defaultDir = dirPath
  }

  const certFiles = fs.readdirSync(defaultDir).filter(file => file.endsWith('.crt')).map(file => path.join(defaultDir, file))

  // If no certificates are found in the default directory, check the fallback path
  const stacksDir = path.join(os.homedir(), '.stacks', 'ssl')
  certFiles.push(...(fs.readdirSync(stacksDir).filter(file => file.endsWith('.crt')).map(file => path.join(stacksDir, file))))

  return certFiles
}
