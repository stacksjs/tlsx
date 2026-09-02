/**
 * Linux system trust store: distro detection, anchor placement, the bundle
 * fingerprint check, and the trust handler on top of it.
 *
 * Nothing here touches the real machine. Every test builds a fake filesystem
 * root in a temp dir (its own /etc/os-release, anchor dirs, CA bundle) and
 * injects a recording `exec`, so no sudo prompt and no certutil. The fake
 * `exec` also simulates `update-ca-certificates` by regenerating the bundle
 * from the anchor dir, which is what lets the "second run is a no-op" cases
 * be asserted end to end.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRootCA } from '../src/certificate/generate'
import {
  detectLinuxDistroFamily,
  findLinuxCaBundle,
  installCAIntoLinuxSystemStore,
  isCertTrustedOnLinux,
  LINUX_DISTRO_STORES,
  linuxAnchorFileName,
  parseOsRelease,
  readLinuxDistroFamily,
  removeCAFromLinuxSystemStore,
} from '../src/certificate/linux-trust'
import { addCertToSystemTrustStore, installCA, isCertTrusted } from '../src/certificate/trust'
import { getCertSha256Fingerprint } from '../src/certificate/validation'

const OS_RELEASE = {
  raspbian: 'PRETTY_NAME="Raspbian GNU/Linux 12 (bookworm)"\nNAME="Raspbian GNU/Linux"\nID=raspbian\nID_LIKE=debian\nVERSION_ID="12"\n',
  debian: 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nID=debian\n',
  ubuntu: 'NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\n',
  pop: 'ID=pop\nID_LIKE="ubuntu debian"\n',
  rocky: 'NAME="Rocky Linux"\nID="rocky"\nID_LIKE="rhel centos fedora"\n',
  fedora: 'ID=fedora\n',
  alma: 'ID="almalinux"\nID_LIKE="rhel centos fedora"\n',
  arch: 'NAME="Arch Linux"\nID=arch\n',
  manjaro: 'ID=manjaro\nID_LIKE=arch\n',
  nixos: 'ID=nixos\n',
}

let root: string
let caCertPath: string
let caPem: string
let otherPem: string
let commands: string[]

function writeFile(rel: string, contents: string): void {
  const file = path.join(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

function fakeRoot(osRelease?: string): void {
  if (osRelease !== undefined)
    writeFile('etc/os-release', osRelease)
}

/** Records commands; `update-ca-certificates` rebuilds the Debian bundle from the anchors. */
async function exec(command: string): Promise<{ stdout: string, stderr: string }> {
  commands.push(command)
  if (command === 'update-ca-certificates') {
    const anchorDir = path.join(root, LINUX_DISTRO_STORES.debian.anchorDir)
    const anchors = fs.existsSync(anchorDir)
      ? fs.readdirSync(anchorDir).filter(f => f.endsWith('.crt')).map(f => fs.readFileSync(path.join(anchorDir, f), 'utf8'))
      : []
    writeFile('etc/ssl/certs/ca-certificates.crt', [otherPem, ...anchors].join(''))
  }
  return { stdout: '', stderr: '' }
}

async function failingExec(command: string): Promise<{ stdout: string, stderr: string }> {
  commands.push(command)
  throw new Error(`Failed to execute command: ${command}\nError: sudo: a password is required`)
}

const ca = await createRootCA({ commonName: 'Pi Stacks Root CA', organization: 'Pi Stacks', validityYears: 5 })
const other = await createRootCA({ commonName: 'Some Other CA', validityYears: 5 })

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tlsx-linux-root-'))
  commands = []
  caPem = ca.certificate
  otherPem = other.certificate
  caCertPath = path.join(root, 'home', 'pi', '.stacks', 'ssl', 'root-ca.crt')
  fs.mkdirSync(path.dirname(caCertPath), { recursive: true })
  fs.writeFileSync(caCertPath, caPem)
  // installCA reuses the on-disk CA only when the key sits beside it.
  fs.writeFileSync(caCertPath.replace(/\.crt$/, '.key'), ca.privateKey, { mode: 0o600 })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('os-release parsing and distro detection', () => {
  it('parses quoted and unquoted values, skipping comments', () => {
    expect(parseOsRelease('# comment\nID=debian\nID_LIKE="ubuntu debian"\nNAME=\'X\'\n\nBROKEN\n')).toEqual({
      ID: 'debian',
      ID_LIKE: 'ubuntu debian',
      NAME: 'X',
    })
  })

  it('maps Debian-family ids, including Raspberry Pi OS and derivatives via ID_LIKE', () => {
    expect(detectLinuxDistroFamily(OS_RELEASE.raspbian)).toBe('debian')
    expect(detectLinuxDistroFamily(OS_RELEASE.debian)).toBe('debian')
    expect(detectLinuxDistroFamily(OS_RELEASE.ubuntu)).toBe('debian')
    expect(detectLinuxDistroFamily(OS_RELEASE.pop)).toBe('debian')
  })

  it('maps RHEL-family ids', () => {
    expect(detectLinuxDistroFamily(OS_RELEASE.rocky)).toBe('rhel')
    expect(detectLinuxDistroFamily(OS_RELEASE.fedora)).toBe('rhel')
    expect(detectLinuxDistroFamily(OS_RELEASE.alma)).toBe('rhel')
  })

  it('maps Arch-family ids and reports unknown otherwise', () => {
    expect(detectLinuxDistroFamily(OS_RELEASE.arch)).toBe('arch')
    expect(detectLinuxDistroFamily(OS_RELEASE.manjaro)).toBe('arch')
    expect(detectLinuxDistroFamily(OS_RELEASE.nixos)).toBe('unknown')
    expect(detectLinuxDistroFamily('')).toBe('unknown')
  })

  it('readLinuxDistroFamily reads /etc/os-release under the given root', () => {
    fakeRoot(OS_RELEASE.raspbian)
    expect(readLinuxDistroFamily(root)).toBe('debian')
  })

  it('readLinuxDistroFamily falls back to /usr/lib/os-release, then to probing anchor dirs', () => {
    expect(readLinuxDistroFamily(root)).toBe('unknown')
    writeFile('usr/lib/os-release', OS_RELEASE.rocky)
    expect(readLinuxDistroFamily(root)).toBe('rhel')
    fs.rmSync(path.join(root, 'usr/lib/os-release'))
    fs.mkdirSync(path.join(root, LINUX_DISTRO_STORES.arch.anchorDir), { recursive: true })
    expect(readLinuxDistroFamily(root)).toBe('arch')
  })

  it('an unrecognised ID does not stop the anchor-dir probe', () => {
    fakeRoot(OS_RELEASE.nixos)
    fs.mkdirSync(path.join(root, LINUX_DISTRO_STORES.debian.anchorDir), { recursive: true })
    expect(readLinuxDistroFamily(root)).toBe('debian')
  })
})

describe('linuxAnchorFileName', () => {
  it('slugs the CA name and appends .crt', () => {
    expect(linuxAnchorFileName('Local Development Root CA')).toBe('local-development-root-ca.crt')
    expect(linuxAnchorFileName('  Pi/Stacks: Root!  ')).toBe('pi-stacks-root.crt')
    expect(linuxAnchorFileName('***')).toBe('tlsx-root-ca.crt')
  })
})

describe('isCertTrustedOnLinux', () => {
  it('is false with no bundle, false when the bundle lacks the CA, true once it is there', () => {
    expect(findLinuxCaBundle(root)).toBeUndefined()
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(false)

    writeFile('etc/ssl/certs/ca-certificates.crt', otherPem)
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(false)

    writeFile('etc/ssl/certs/ca-certificates.crt', `${otherPem}# a comment between blocks\n${caPem}`)
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(true)
    // PEM text works as well as a path.
    expect(isCertTrustedOnLinux(caPem, root)).toBe(true)
  })

  it('also finds the RHEL bundle', () => {
    writeFile('etc/pki/tls/certs/ca-bundle.crt', caPem)
    expect(findLinuxCaBundle(root)).toBe(path.join(root, 'etc/pki/tls/certs/ca-bundle.crt'))
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(true)
  })

  it('matches by fingerprint, not by text', () => {
    // Same DER, different line wrapping: still the same certificate.
    const rewrapped = caPem.replace(/\n/g, '').replace('-----BEGIN CERTIFICATE-----', '-----BEGIN CERTIFICATE-----\n').replace('-----END CERTIFICATE-----', '\n-----END CERTIFICATE-----\n')
    writeFile('etc/ssl/certs/ca-certificates.crt', rewrapped)
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(true)
    expect(getCertSha256Fingerprint(rewrapped)).toBe(getCertSha256Fingerprint(caPem))
  })
})

describe('installCAIntoLinuxSystemStore', () => {
  it('debian as root: writes the anchor and runs update-ca-certificates directly', async () => {
    fakeRoot(OS_RELEASE.raspbian)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })

    expect(result.status).toBe('installed')
    expect(result.family).toBe('debian')
    expect(result.updateCommand).toBe('update-ca-certificates')
    expect(result.anchorPath).toBe(path.join(root, 'usr/local/share/ca-certificates/pi-stacks-root-ca.crt'))
    expect(fs.readFileSync(result.anchorPath!, 'utf8')).toBe(caPem)
    expect(fs.statSync(result.anchorPath!).mode & 0o777).toBe(0o644)
    expect(commands).toEqual(['update-ca-certificates'])
    expect(result.commands).toEqual(commands)
    // The (simulated) bundle now carries the CA.
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(true)
  })

  it('debian as a normal user: one sudo chain, nothing written by us', async () => {
    fakeRoot(OS_RELEASE.debian)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: false })

    expect(result.status).toBe('installed')
    expect(commands).toHaveLength(1)
    const cmd = commands[0]!
    expect(cmd.startsWith('sudo mkdir -p ')).toBe(true)
    expect(cmd).toContain(`sudo cp '${caCertPath}' '${result.anchorPath}'`)
    expect(cmd).toContain(`sudo chmod 644 '${result.anchorPath}'`)
    expect(cmd.endsWith(' && sudo update-ca-certificates')).toBe(true)
    expect(cmd.split(' && ')).toHaveLength(4)
    expect(fs.existsSync(result.anchorPath!)).toBe(false)
  })

  it('shell-quotes paths in the sudo chain', async () => {
    fakeRoot(OS_RELEASE.debian)
    const odd = path.join(root, 'home', "o'neil", 'ca cert.crt')
    fs.mkdirSync(path.dirname(odd), { recursive: true })
    fs.writeFileSync(odd, caPem)
    await installCAIntoLinuxSystemStore(odd, { root, exec, isRoot: false })
    expect(commands[0]).toContain(`sudo cp '${path.join(root, 'home', "o'\\''neil", 'ca cert.crt')}'`)
  })

  it('rhel: anchors under /etc/pki/ca-trust/source/anchors and runs update-ca-trust', async () => {
    fakeRoot(OS_RELEASE.rocky)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    expect(result.status).toBe('installed')
    expect(result.family).toBe('rhel')
    expect(result.anchorPath).toBe(path.join(root, 'etc/pki/ca-trust/source/anchors/pi-stacks-root-ca.crt'))
    expect(fs.readFileSync(result.anchorPath!, 'utf8')).toBe(caPem)
    expect(commands).toEqual(['update-ca-trust'])

    commands = []
    const asUser = await installCAIntoLinuxSystemStore(caCertPath, { root: fs.mkdtempSync(path.join(os.tmpdir(), 'tlsx-rhel-')), exec, isRoot: false })
    expect(asUser.status).toBe('unsupported')
  })

  it('rhel as a normal user ends the chain with sudo update-ca-trust', async () => {
    fakeRoot(OS_RELEASE.fedora)
    await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: false })
    expect(commands[0]).toContain('/etc/pki/ca-trust/source/anchors/pi-stacks-root-ca.crt')
    expect(commands[0]!.endsWith(' && sudo update-ca-trust')).toBe(true)
  })

  it('arch: trust-source anchors and trust extract-compat', async () => {
    fakeRoot(OS_RELEASE.arch)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    expect(result.status).toBe('installed')
    expect(result.anchorPath).toBe(path.join(root, 'etc/ca-certificates/trust-source/anchors/pi-stacks-root-ca.crt'))
    expect(commands).toEqual(['trust extract-compat'])
  })

  it('honours an explicit anchor name', async () => {
    fakeRoot(OS_RELEASE.debian)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true, name: 'rpx' })
    expect(result.anchorPath).toBe(path.join(root, 'usr/local/share/ca-certificates/rpx.crt'))
  })

  it('skips everything, including sudo, when the bundle already has the CA', async () => {
    fakeRoot(OS_RELEASE.raspbian)
    writeFile('etc/ssl/certs/ca-certificates.crt', `${otherPem}${caPem}`)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: false })
    expect(result.status).toBe('already-trusted')
    expect(commands).toEqual([])
    expect(fs.existsSync(result.anchorPath!)).toBe(false)
  })

  it('a second install after a real update is a no-op', async () => {
    fakeRoot(OS_RELEASE.raspbian)
    const first = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    expect(first.status).toBe('installed')
    commands = []
    const second = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    expect(second.status).toBe('already-trusted')
    expect(commands).toEqual([])
  })

  it('reports unsupported (and runs nothing) on an unrecognised distro', async () => {
    fakeRoot(OS_RELEASE.nixos)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    expect(result.status).toBe('unsupported')
    expect(result.family).toBe('unknown')
    expect(result.error).toContain('os-release')
    expect(commands).toEqual([])
    expect(fs.existsSync(path.join(root, 'usr/local/share/ca-certificates'))).toBe(false)
  })

  it('reports failed with the command error when the update command fails', async () => {
    fakeRoot(OS_RELEASE.debian)
    const result = await installCAIntoLinuxSystemStore(caCertPath, { root, exec: failingExec, isRoot: false })
    expect(result.status).toBe('failed')
    expect(result.error).toContain('sudo: a password is required')
    expect(result.commands).toHaveLength(1)
  })
})

describe('removeCAFromLinuxSystemStore', () => {
  it('removes the anchor and regenerates the bundle (root), reports not-found afterwards', async () => {
    fakeRoot(OS_RELEASE.raspbian)
    const installed = await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    commands = []

    const removed = await removeCAFromLinuxSystemStore('Pi Stacks Root CA', { root, exec, isRoot: true })
    expect(removed.status).toBe('removed')
    expect(removed.anchorPath).toBe(installed.anchorPath)
    expect(fs.existsSync(installed.anchorPath!)).toBe(false)
    expect(commands).toEqual(['update-ca-certificates'])
    expect(isCertTrustedOnLinux(caCertPath, root)).toBe(false)

    const again = await removeCAFromLinuxSystemStore('Pi Stacks Root CA', { root, exec, isRoot: true })
    expect(again.status).toBe('not-found')
  })

  it('uses sudo rm and sudo update as a normal user', async () => {
    fakeRoot(OS_RELEASE.debian)
    await installCAIntoLinuxSystemStore(caCertPath, { root, exec, isRoot: true })
    commands = []
    const removed = await removeCAFromLinuxSystemStore('Pi Stacks Root CA', { root, exec, isRoot: false })
    expect(removed.status).toBe('removed')
    expect(commands).toEqual([`sudo rm -f '${removed.anchorPath}' && sudo update-ca-certificates`])
  })
})

describe('trust handler on linux (platform + homedir pinned)', () => {
  const originalPlatform = os.platform
  const originalHomedir = os.homedir
  let home: string

  beforeEach(() => {
    // An empty home means no NSS databases, which is exactly the headless
    // case this feature exists for.
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'tlsx-empty-home-'))
    Object.defineProperty(os, 'platform', { value: () => 'linux', configurable: true })
    Object.defineProperty(os, 'homedir', { value: () => home, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(os, 'platform', { value: originalPlatform, configurable: true })
    Object.defineProperty(os, 'homedir', { value: originalHomedir, configurable: true })
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('addCertToSystemTrustStore installs into the system store and trusts on it', async () => {
    fakeRoot(OS_RELEASE.raspbian)
    const report = await addCertToSystemTrustStore(caCertPath, { verbose: false, linux: { root, exec, isRoot: true } })
    expect(report.platform).toBe('linux')
    expect(report.trusted).toBe(true)
    expect(report.stores.filter(entry => entry.store === 'linux-system')).toEqual([
      { store: 'linux-system', location: path.join(root, 'usr/local/share/ca-certificates/pi-stacks-root-ca.crt'), status: 'installed' },
    ])
    expect(commands).toEqual(['update-ca-certificates'])
  })

  it('isCertTrusted answers from the bundle and installCA short-circuits on it', async () => {
    fakeRoot(OS_RELEASE.raspbian)
    const basePath = path.dirname(caCertPath)
    expect(await isCertTrusted(caCertPath, { linux: { root } })).toBe(false)

    const first = await installCA({ basePath, caCertPath, verbose: false, linux: { root, exec, isRoot: true } })
    expect(first.generated).toBe(false)
    expect(first.trustInstalled).toBe(true)
    expect(first.alreadyTrusted).toBe(false)
    expect(first.report.stores[0]).toMatchObject({ store: 'linux-system', status: 'installed' })
    expect(commands).toEqual(['update-ca-certificates'])
    expect(await isCertTrusted(caCertPath, { linux: { root } })).toBe(true)

    commands = []
    const second = await installCA({ basePath, caCertPath, verbose: false, linux: { root, exec, isRoot: true } })
    expect(second.alreadyTrusted).toBe(true)
    expect(second.trustInstalled).toBe(false)
    expect(second.report.trusted).toBe(true)
    expect(second.report.stores).toEqual([{ store: 'linux-system', location: 'system CA bundle', status: 'already-trusted' }])
    expect(commands).toEqual([])
  })

  it('reports a distro it does not know as skipped, and runs no update command', async () => {
    fakeRoot(OS_RELEASE.nixos)
    const report = await addCertToSystemTrustStore(caCertPath, { verbose: false, linux: { root, exec, isRoot: true } })
    const system = report.stores.filter(entry => entry.store === 'linux-system')
    expect(system).toHaveLength(1)
    expect(system[0]).toMatchObject({ store: 'linux-system', status: 'skipped' })
    // Nothing is guessed at: an anchor written where the distribution does not
    // read it, followed by a command that does not exist, would report success
    // and trust nothing.
    expect(commands).toEqual([])
  })
})
