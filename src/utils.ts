import type { CertDetails, CertificateOptions } from './types'
import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { pki } from 'node-forge'
import { config } from './config'

/**
 * Checks if a certificate is valid for a given domain.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @param domain - The domain to check.
 * @returns {boolean} - True if the certificate is valid for the domain, false otherwise.
 */
export function isCertValidForDomain(certPemOrPath: string, domain: string): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const altNames = cert.getExtension('subjectAltName')

  if (altNames) {
    // @ts-expect-error - altNames is not yet typed at lib level
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
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns {CertDetails} - An object containing certificate details.
 */
export function parseCertDetails(certPemOrPath: string): CertDetails {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)

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
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns {boolean} - True if the certificate is expired, false otherwise.
 */
export function isCertExpired(certPemOrPath: string): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const now = new Date()

  return now > cert.validity.notAfter
}

/**
 * Gets a certificate from a PEM string or a path to a certificate file.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns {pki.Certificate} - The certificate object.
 */
export function getCertificateFromCertPemOrPath(certPemOrPath: string): pki.Certificate {
  let certPem: string

  if (certPemOrPath.startsWith('-----BEGIN CERTIFICATE-----')) {
    // If the input is a PEM string
    certPem = certPemOrPath
  }
  else {
    // If the input is a path to the certificate file
    certPem = readCertFromFile(certPemOrPath)
  }

  return pki.certificateFromPem(certPem)
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
    }
    else if (platform === 'win32') {
      // Windows default certificate directory
      defaultDir = 'C:\\Windows\\System32\\certsrv\\CertEnroll'
    }
    else if (platform === 'linux') {
      // Linux default certificate directory
      defaultDir = '/etc/ssl/certs'
    }
    else {
      throw new Error(`Unsupported platform: ${platform}`)
    }
  }
  else {
    defaultDir = dirPath
  }

  const certFiles = fs
    .readdirSync(defaultDir)
    .filter(file => file.endsWith('.crt'))
    .map(file => path.join(defaultDir, file))

  // If no certificates are found in the default directory, check the fallback path
  const stacksDir = path.join(os.homedir(), '.stacks', 'ssl')
  certFiles.push(
    ...fs
      .readdirSync(stacksDir)
      .filter(file => file.endsWith('.crt'))
      .map(file => path.join(stacksDir, file)),
  )

  return certFiles
}

export function makeNumberPositive(hexString: string): string {
  let mostSignificativeHexDigitAsInt = Number.parseInt(hexString[0], 16)

  if (mostSignificativeHexDigitAsInt < 8)
    return hexString

  mostSignificativeHexDigitAsInt -= 8

  return mostSignificativeHexDigitAsInt.toString() + hexString.substring(1)
}

export function findFoldersWithFile(rootDir: string, fileName: string): string[] {
  const result: string[] = []

  function search(dir: string) {
    try {
      const files = fs.readdirSync(dir)

      for (const file of files) {
        const filePath = path.join(dir, file)
        const stats = fs.lstatSync(filePath)

        if (stats.isDirectory()) {
          search(filePath)
        }
        else if (file === fileName) {
          result.push(dir)
        }
      }
    }
    catch (error) {
      console.warn(`Error reading directory ${dir}: ${error}`)
    }
  }

  search(rootDir)
  return result
}

export function debugLog(category: string, message: string, verbose?: boolean): void {
  if (verbose || config.verbose) {
    // eslint-disable-next-line no-console
    console.debug(`[tlsx:${category}] ${message}`)
  }
}

// Promisify the exec function to use with async/await
const execAsync = promisify(exec)

interface CommandResult {
  stdout: string
  stderr: string
}

/**
 * Executes a shell command and returns the result
 * @param command - The shell command to execute
 * @param options - Optional execution options
 * @param options.cwd - The cwd
 * @param options.timeout - The timeout, default: 30000 // 30s
 * @returns Promise that resolves with stdout and stderr
 * @throws Error if the command fails
 */
export async function runCommand(
  command: string,
  options: { cwd?: string, timeout?: number } = {},
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || 30000, // Default 30s timeout
    })

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }
  }
  catch (error: any) {
    // Enhance error message with command details
    const enhancedError = new Error(
      `Failed to execute command: ${command}\nError: ${error.message}`,
    )
    enhancedError.stack = error.stack
    throw enhancedError
  }
}

/**
 * Gets the primary domain from options
 * @param options Certificate generation options
 * @throws Error if no domain is specified
 * @returns Primary domain
 */
export function getPrimaryDomain(options: CertificateOptions): string {
  if (options.domain) {
    return options.domain
  }

  if (options.domains?.length) {
    return options.domains[0]
  }

  throw new Error('Either domain or domains must be specified')
}
