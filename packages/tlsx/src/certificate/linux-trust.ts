/**
 * Linux system trust store support.
 *
 * The NSS/certutil path in `trust.ts` only reaches browser profiles under
 * `$HOME`. A headless box (a Raspberry Pi running a gateway, a CI runner, a
 * container) has no such profiles, so the CA never landed anywhere the
 * system's TLS clients (curl, Bun, Node with system roots, the distro's own
 * services) would look. This module installs the CA into the distro-wide
 * store instead, using the same two-step every distro documents: drop a PEM
 * anchor into the distro's anchor directory, then run the distro's bundle
 * regeneration command.
 *
 * Everything that touches the machine is injectable (`root`, `exec`,
 * `isRoot`) so the whole flow can be exercised against a temp directory with
 * recorded commands and no sudo prompt.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { config } from '../config'
import { LOG_CATEGORIES } from '../constants'
import { debugLog, runCommand } from '../utils'
import { getCertCommonName, getCertSha256Fingerprint, pemBundleHasFingerprint } from './validation'

/** Which family of trust-store layout a Linux distro follows. */
export type LinuxDistroFamily = 'debian' | 'rhel' | 'arch' | 'unknown'

/**
 * Environment hooks for the Linux trust-store code. Production callers leave
 * every field unset; tests point `root` at a temp directory, record `exec`,
 * and pin `isRoot` so neither sudo nor the real `/etc` is involved.
 */
export interface LinuxTrustEnv {
  /** Filesystem root the store lives under. @default '/' */
  root?: string
  /** Command runner. @default runCommand from utils (honours SUDO_PASSWORD) */
  exec?: (command: string) => Promise<{ stdout: string, stderr: string }>
  /** Whether the current process already runs as root. @default process.getuid() === 0 */
  isRoot?: boolean
}

export interface LinuxSystemTrustOptions extends LinuxTrustEnv {
  /**
   * Basename for the anchor file, before sanitising and the `.crt` suffix.
   * @default the CA certificate's Common Name, falling back to config.commonName
   */
  name?: string
  verbose?: boolean
}

export type LinuxSystemTrustStatus
  = 'installed' | 'already-trusted' | 'removed' | 'not-found' | 'unsupported' | 'failed'

export interface LinuxSystemTrustResult {
  family: LinuxDistroFamily
  /** Where the anchor file was (or would have been) written. */
  anchorPath?: string
  /** The bundle regeneration command for this family. */
  updateCommand?: string
  /** Every shell command that was run, in order. Empty when nothing ran. */
  commands: string[]
  status: LinuxSystemTrustStatus
  error?: string
}

export interface LinuxDistroStore {
  family: Exclude<LinuxDistroFamily, 'unknown'>
  /** Directory the distro scans for extra anchors. */
  anchorDir: string
  /** Command that regenerates the consolidated bundle from the anchors. */
  updateCommand: string
  /** Consolidated PEM bundles this family writes, most common first. */
  bundles: string[]
}

/** Per-family layout: where anchors go, what regenerates the bundle, where the bundle ends up. */
export const LINUX_DISTRO_STORES: Record<Exclude<LinuxDistroFamily, 'unknown'>, LinuxDistroStore> = {
  debian: {
    family: 'debian',
    anchorDir: '/usr/local/share/ca-certificates',
    updateCommand: 'update-ca-certificates',
    bundles: ['/etc/ssl/certs/ca-certificates.crt'],
  },
  rhel: {
    family: 'rhel',
    anchorDir: '/etc/pki/ca-trust/source/anchors',
    updateCommand: 'update-ca-trust',
    bundles: ['/etc/pki/tls/certs/ca-bundle.crt', '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'],
  },
  arch: {
    family: 'arch',
    anchorDir: '/etc/ca-certificates/trust-source/anchors',
    updateCommand: 'trust extract-compat',
    bundles: ['/etc/ca-certificates/extracted/tls-ca-bundle.pem', '/etc/ssl/certs/ca-certificates.crt'],
  },
}

// `ID` / `ID_LIKE` values from /etc/os-release, lower-cased. Alpine ships the
// Debian-style `update-ca-certificates`, so it belongs with that family.
const DEBIAN_IDS = new Set(['debian', 'ubuntu', 'raspbian', 'linuxmint', 'pop', 'elementary', 'kali', 'neon', 'zorin', 'alpine'])
const RHEL_IDS = new Set(['rhel', 'fedora', 'centos', 'rocky', 'almalinux', 'ol', 'oracle', 'amzn'])
const ARCH_IDS = new Set(['arch', 'archarm', 'manjaro', 'endeavouros', 'garuda'])

/**
 * Parse the `KEY=value` lines of an os-release file. Quotes are stripped;
 * comments and blank lines are ignored.
 */
export function parseOsRelease(contents: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#'))
      continue
    const eq = line.indexOf('=')
    if (eq === -1)
      continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
      value = value.slice(1, -1)
    result[key] = value
  }
  return result
}

/**
 * Classify a distro from the contents of its os-release file. `ID` wins,
 * then each entry of `ID_LIKE` in order, so a derivative that names its
 * parent (Raspberry Pi OS: `ID=debian`; Pop!_OS: `ID_LIKE="ubuntu debian"`)
 * resolves without being listed by name.
 */
export function detectLinuxDistroFamily(osRelease: string): LinuxDistroFamily {
  const fields = parseOsRelease(osRelease)
  const candidates = [fields.ID ?? '', ...(fields.ID_LIKE ?? '').split(/\s+/)]
    .map(id => id.trim().toLowerCase())
    .filter(Boolean)

  for (const id of candidates) {
    if (DEBIAN_IDS.has(id))
      return 'debian'
    if (RHEL_IDS.has(id))
      return 'rhel'
    if (ARCH_IDS.has(id))
      return 'arch'
  }
  return 'unknown'
}

/**
 * Detect the distro family of the system rooted at `root`. Reads
 * `/etc/os-release` (then the `/usr/lib` fallback the spec allows); when
 * neither classifies the system, falls back to probing for the anchor
 * directory each family uses, so an unlisted distro with a standard layout
 * still works.
 */
export function readLinuxDistroFamily(root = '/'): LinuxDistroFamily {
  for (const candidate of ['/etc/os-release', '/usr/lib/os-release']) {
    const file = path.join(root, candidate)
    if (!fs.existsSync(file))
      continue
    try {
      const family = detectLinuxDistroFamily(fs.readFileSync(file, 'utf8'))
      if (family !== 'unknown')
        return family
    }
    catch {
      // Unreadable; try the next source.
    }
  }

  for (const store of Object.values(LINUX_DISTRO_STORES)) {
    if (fs.existsSync(path.join(root, store.anchorDir)))
      return store.family
  }
  return 'unknown'
}

/**
 * The anchor filename for a CA name: lower-case, runs of anything that is
 * not alphanumeric collapsed to a single hyphen, `.crt` suffix. Debian's
 * `update-ca-certificates` only picks up `.crt` files, and a CN like
 * "Local Development Root CA" must not become a filename with spaces.
 */
export function linuxAnchorFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'tlsx-root-ca'}.crt`
}

/**
 * The first consolidated CA bundle present under `root`, across every
 * family, or undefined when the system has none.
 */
export function findLinuxCaBundle(root = '/'): string | undefined {
  const seen = new Set<string>()
  for (const store of Object.values(LINUX_DISTRO_STORES)) {
    for (const bundle of store.bundles) {
      if (seen.has(bundle))
        continue
      seen.add(bundle)
      const file = path.join(root, bundle)
      if (fs.existsSync(file))
        return file
    }
  }
  return undefined
}

/**
 * Whether the CA is already in the system's consolidated bundle. This is the
 * real "is it trusted" check for Linux: no openssl, no certutil. The CA's
 * SHA-256 fingerprint is compared against every PEM block in the bundle.
 * @param caCertPemOrPath - The CA certificate as PEM or a path to it.
 * @param root - Filesystem root. @default '/'
 */
export function isCertTrustedOnLinux(caCertPemOrPath: string, root = '/'): boolean {
  const bundle = findLinuxCaBundle(root)
  if (!bundle)
    return false
  try {
    const fingerprint = getCertSha256Fingerprint(caCertPemOrPath)
    return pemBundleHasFingerprint(fs.readFileSync(bundle, 'utf8'), fingerprint)
  }
  catch {
    return false
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function resolveEnv(options: LinuxTrustEnv): Required<LinuxTrustEnv> {
  return {
    root: options.root ?? '/',
    exec: options.exec ?? (command => runCommand(command)),
    isRoot: options.isRoot ?? (process.getuid?.() === 0),
  }
}

function defaultAnchorName(caCertPath: string): string {
  try {
    return getCertCommonName(caCertPath) || config.commonName
  }
  catch {
    return config.commonName
  }
}

/**
 * Install a CA certificate into the distro-wide trust store: copy the PEM to
 * the family's anchor directory and regenerate the bundle. Skips the whole
 * step (no sudo prompt) when the bundle already contains the CA. Uses `sudo`
 * only when the process is not already root; as root it writes the anchor
 * directly and runs the update command bare.
 *
 * Never throws for a store problem: the outcome is in `status` / `error` so
 * the caller can decide whether an unsupported distro is fatal.
 * @param caCertPath - Path to the CA certificate (PEM).
 * @param options - Anchor name, verbosity, and the environment hooks.
 */
export async function installCAIntoLinuxSystemStore(caCertPath: string, options: LinuxSystemTrustOptions = {}): Promise<LinuxSystemTrustResult> {
  const { root, exec, isRoot } = resolveEnv(options)
  const family = readLinuxDistroFamily(root)
  const commands: string[] = []
  debugLog(LOG_CATEGORIES.TRUST, `Linux distro family: ${family} (root=${root}, isRoot=${isRoot})`, options.verbose)

  if (family === 'unknown') {
    return {
      family,
      commands,
      status: 'unsupported',
      error: 'could not detect a supported distro family from /etc/os-release (debian, rhel or arch)',
    }
  }

  const store = LINUX_DISTRO_STORES[family]
  const anchorDir = path.join(root, store.anchorDir)
  const anchorPath = path.join(anchorDir, linuxAnchorFileName(options.name ?? defaultAnchorName(caCertPath)))
  const base = { family, anchorPath, updateCommand: store.updateCommand, commands }

  if (isCertTrustedOnLinux(caCertPath, root)) {
    debugLog(LOG_CATEGORIES.TRUST, 'CA already present in the system bundle, not rerunning the update', options.verbose)
    return { ...base, status: 'already-trusted' }
  }

  try {
    if (isRoot) {
      fs.mkdirSync(anchorDir, { recursive: true })
      fs.copyFileSync(caCertPath, anchorPath)
      fs.chmodSync(anchorPath, 0o644)
      commands.push(store.updateCommand)
      debugLog(LOG_CATEGORIES.TRUST, `Wrote ${anchorPath}; running ${store.updateCommand}`, options.verbose)
      await exec(store.updateCommand)
    }
    else {
      // One chained command so a single sudo prompt covers all four steps
      // (sudo caches the credential for the rest of the chain).
      const command = [
        `sudo mkdir -p ${shellQuote(anchorDir)}`,
        `sudo cp ${shellQuote(caCertPath)} ${shellQuote(anchorPath)}`,
        `sudo chmod 644 ${shellQuote(anchorPath)}`,
        `sudo ${store.updateCommand}`,
      ].join(' && ')
      commands.push(command)
      debugLog(LOG_CATEGORIES.TRUST, `Running: ${command}`, options.verbose)
      await exec(command)
    }
    return { ...base, status: 'installed' }
  }
  catch (error) {
    debugLog(LOG_CATEGORIES.TRUST, `System trust store install failed: ${error}`, options.verbose)
    return { ...base, status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Remove a CA anchor installed by {@link installCAIntoLinuxSystemStore} and
 * regenerate the bundle. `name` is the same name the install used (the CA's
 * Common Name by default). Reports `not-found` when there is no such anchor.
 * @param name - Anchor name, before sanitising.
 * @param options - Verbosity and the environment hooks.
 */
export async function removeCAFromLinuxSystemStore(name: string, options: LinuxTrustEnv & { verbose?: boolean } = {}): Promise<LinuxSystemTrustResult> {
  const { root, exec, isRoot } = resolveEnv(options)
  const family = readLinuxDistroFamily(root)
  const commands: string[] = []

  if (family === 'unknown')
    return { family, commands, status: 'unsupported', error: 'could not detect a supported distro family' }

  const store = LINUX_DISTRO_STORES[family]
  const anchorPath = path.join(root, store.anchorDir, linuxAnchorFileName(name))
  const base = { family, anchorPath, updateCommand: store.updateCommand, commands }

  if (!fs.existsSync(anchorPath))
    return { ...base, status: 'not-found' }

  try {
    if (isRoot) {
      fs.unlinkSync(anchorPath)
      commands.push(store.updateCommand)
      await exec(store.updateCommand)
    }
    else {
      const command = `sudo rm -f ${shellQuote(anchorPath)} && sudo ${store.updateCommand}`
      commands.push(command)
      await exec(command)
    }
    return { ...base, status: 'removed' }
  }
  catch (error) {
    return { ...base, status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}
