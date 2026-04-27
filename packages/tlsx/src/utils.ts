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
  if (fs.existsSync(stacksDir)) {
    certFiles.push(
      ...fs
        .readdirSync(stacksDir)
        .filter(file => file.endsWith('.crt'))
        .map(file => path.join(stacksDir, file)),
    )
  }

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
    let files: string[]
    try {
      files = fs.readdirSync(dir)
    }
    catch {
      return
    }

    for (const file of files) {
      const filePath = path.join(dir, file)
      try {
        const stats = fs.statSync(filePath)

        if (stats.isDirectory()) {
          search(filePath)
        }
        else if (file === fileName) {
          result.push(dir)
        }
      }
      catch {
        continue
      }
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
 * Get sudo password from environment variable if set.
 * When set, sudo invocations automatically pipe the password via `sudo -S`
 * so the user is never prompted (useful for `./buddy dev` where reading
 * /etc/hosts and adding certs to the keychain both need sudo).
 */
export function getSudoPassword(): string | undefined {
  return process.env.SUDO_PASSWORD
}

/**
 * Rewrite a command so the caller's sudo invocations are non-interactive
 * when SUDO_PASSWORD is set. We only touch leading `sudo ` (and pipelines
 * like `... | sudo ...`) — embedded `sudo` words elsewhere in the command
 * are left untouched. The transform is shape-preserving: it adds `-S` and
 * a stdin pipe, never reorders arguments.
 */
function maybePipeSudoPassword(command: string): string {
  const pwd = getSudoPassword()
  if (!pwd || !/(^|\|\s*|&&\s*|;\s*)sudo\s/.test(command))
    return command

  const escapedPwd = pwd.replace(/'/g, `'\\''`)
  // Replace any `sudo ` that doesn't already use `-S` or `-n` with one that
  // reads the password from stdin, and prefix the whole pipeline with the
  // password echo. Each leading sudo gets the same stdin (sudo caches creds
  // for ~5 minutes after the first call within a process tree).
  const transformed = command.replace(/(^|\|\s*|&&\s*|;\s*)sudo(?!\s+-[Sn])(\s+)/g, '$1sudo -S$2')
  return `echo '${escapedPwd}' | ${transformed}`
}

/**
 * Executes a shell command and returns the result.
 *
 * When the command starts with (or pipes into) `sudo` and `SUDO_PASSWORD` is
 * set in the environment, the password is piped via `sudo -S` so no
 * interactive prompt is shown. Commands that already pass `-S` or `-n`
 * are left as-is.
 *
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
  const finalCommand = maybePipeSudoPassword(command)
  try {
    const { stdout, stderr } = await execAsync(finalCommand, {
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || 30000, // Default 30s timeout
    })

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }
  }
  catch (error: any) {
    // Enhance error message with command details. We log the original
    // command (without the piped password) so error reports stay readable
    // and never leak secrets.
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
 * @param options.basePath Base directory for certificate files, defaults to config.basePath
 * @param options.certPath Path to the certificate file, resolved against basePath if relative
 * @param options.keyPath Path to the private key file, resolved against basePath if relative
 * @param options.caCertPath Path to the CA certificate file, resolved against basePath if relative
 * @returns Normalized file paths
 */
export function normalizeCertPaths(options: {
  basePath?: string
  certPath?: string
  keyPath?: string
  caCertPath?: string
}): { certPath: string, keyPath: string, caCertPath: string, basePath: string } {
  // Default to ~/.stacks/ssl if basePath is empty or not provided
  const defaultBasePath = path.join(os.homedir(), '.stacks', 'ssl')
  const basePath = options.basePath && options.basePath.trim() !== ''
    ? options.basePath
    : (config.basePath && config.basePath.trim() !== '' ? config.basePath : defaultBasePath)

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
    certPath,
    keyPath,
    caCertPath,
    basePath,
  }
}
