import type { CertificateOptions } from './types'
import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { config } from './config'

/**
 * Reads a certificate from a file.
 * @param certPath - Path to the certificate file.
 * @returns {string} - The certificate content.
 */
export function readCertFromFile(certPath: string): string {
  return fs.readFileSync(certPath, 'utf8')
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

/**
 * Normalizes certificate paths based on basePath and defaults
 * @param options Options that may contain file paths
 * @returns Normalized file paths
 */
export function normalizeCertPaths(options: {
  basePath?: string
  certPath?: string
  keyPath?: string
  caCertPath?: string
}): { certPath: string; keyPath: string; caCertPath: string; basePath: string } {
  const basePath = options.basePath || config.basePath

  // Resolve paths properly
  const certPath = options.certPath
    ? path.isAbsolute(options.certPath)
      ? options.certPath
      : path.join(basePath, options.certPath)
    : path.join(basePath, config.certPath)

  const keyPath = options.keyPath
    ? path.isAbsolute(options.keyPath)
      ? options.keyPath
      : path.join(basePath, options.keyPath)
    : path.join(basePath, config.keyPath)

  const caCertPath = options.caCertPath
    ? path.isAbsolute(options.caCertPath)
      ? options.caCertPath
      : path.join(basePath, options.caCertPath)
    : path.join(basePath, config.caCertPath)

  return {
    certPath: certPath,
    keyPath: keyPath,
    caCertPath: caCertPath,
    basePath: basePath,
  }
}
