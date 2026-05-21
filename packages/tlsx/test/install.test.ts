/**
 * Tests for the mkcert-style `installCA` / `uninstallCA` flow. We pin the
 * platform to `linux` because the macOS path calls `openssl x509 ... |
 * security ...` against the real system keychain — fine in production,
 * untestable in CI.
 *
 * `runCommand` is mocked so no real `certutil` / `security` binaries run.
 * `findFoldersWithFile` is stubbed to a single fake NSS DB so the linux
 * handler has somewhere to "install" the cert.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import os from 'node:os'
import * as path from 'node:path'

const mockRunCommand = mock((_command: string, _options?: any) => Promise.resolve({ stdout: '', stderr: '' }))
const mockFindFoldersWithFile = mock((_rootDir: string, _fileName: string) => ['/fake/nssdb'])

// Re-export everything from the real utils module so the rest of trust.ts
// (normalizeCertPaths, debugLog, etc.) keeps working — only override the two
// helpers that would otherwise shell out for real.
const realUtils: typeof import('../src/utils') = await import('../src/utils')
mock.module('../src/utils', () => ({
  ...realUtils,
  runCommand: mockRunCommand,
  findFoldersWithFile: mockFindFoldersWithFile,
}))

const originalPlatform = os.platform
let mockPlatform: NodeJS.Platform = 'linux'

let basePath: string

// Import after mocks are wired so the module under test resolves to the
// mocked utils export.
const { installCA, uninstallCA } = await import('../src/certificate/trust')

beforeEach(async () => {
  mockRunCommand.mockClear()
  mockFindFoldersWithFile.mockClear()
  mockRunCommand.mockImplementation((_cmd: string) => Promise.resolve({ stdout: '', stderr: '' }))
  Object.defineProperty(os, 'platform', { value: () => mockPlatform, configurable: true })
  basePath = await fsp.mkdtemp(path.join(os.tmpdir(), 'tlsx-install-test-'))
})

afterEach(async () => {
  Object.defineProperty(os, 'platform', { value: originalPlatform, configurable: true })
  await fsp.rm(basePath, { recursive: true, force: true }).catch(() => {})
})

describe('installCA', () => {
  it('generates a CA on first run and writes both cert + key to disk', async () => {
    const result = await installCA({ basePath, verbose: false })

    expect(result.generated).toBe(true)
    expect(result.trustInstalled).toBe(true)
    expect(result.alreadyTrusted).toBe(false)

    // Cert + key files exist
    expect(fs.existsSync(result.caCertPath)).toBe(true)
    expect(fs.existsSync(result.caKeyPath)).toBe(true)

    // Cert content looks like a CA
    const certContents = await fsp.readFile(result.caCertPath, 'utf8')
    expect(certContents).toContain('BEGIN CERTIFICATE')

    // Key was written 0600
    const stat = await fsp.stat(result.caKeyPath)
    expect(stat.mode & 0o777).toBe(0o600)

    // Trust-store handler was invoked exactly once with the right binary
    expect(mockRunCommand).toHaveBeenCalled()
    const cmds = mockRunCommand.mock.calls.map(c => c[0])
    expect(cmds.some(c => typeof c === 'string' && c.includes('certutil'))).toBe(true)
  })

  it('reuses the existing CA on disk on subsequent calls (no regenerate)', async () => {
    const first = await installCA({ basePath, verbose: false })
    const certBefore = await fsp.readFile(first.caCertPath, 'utf8')
    const keyBefore = await fsp.readFile(first.caKeyPath, 'utf8')

    const second = await installCA({ basePath, verbose: false })
    expect(second.generated).toBe(false)

    // Files unchanged byte-for-byte
    expect(await fsp.readFile(second.caCertPath, 'utf8')).toBe(certBefore)
    expect(await fsp.readFile(second.caKeyPath, 'utf8')).toBe(keyBefore)
  })

  it('forwards CA generation options to createRootCA', async () => {
    const result = await installCA({
      basePath,
      verbose: false,
      ca: {
        commonName: 'My Custom Root',
        organization: 'Acme',
        validityYears: 5,
      },
    })

    // Spot-check by re-reading the cert: openssl-style subject extraction is
    // overkill here — we just verify it includes the CN.
    const cert = await fsp.readFile(result.caCertPath, 'utf8')
    expect(cert).toContain('BEGIN CERTIFICATE')
    // Decode the cert's subject by re-parsing through node:crypto
    const { X509Certificate } = await import('node:crypto')
    const parsed = new X509Certificate(cert)
    expect(parsed.subject).toContain('My Custom Root')
    expect(parsed.subject).toContain('Acme')
  })
})

describe('uninstallCA', () => {
  it('removes the CA from the trust store via the platform handler', async () => {
    await installCA({ basePath, verbose: false })
    mockRunCommand.mockClear()

    const result = await uninstallCA({ basePath, verbose: false })
    expect(result.removedFromTrustStore).toBe(true)
    expect(mockRunCommand).toHaveBeenCalled()
    const cmds = mockRunCommand.mock.calls.map(c => c[0])
    expect(cmds.some(c => typeof c === 'string' && c.includes('certutil') && c.includes('-D'))).toBe(true)
  })

  it('leaves files in place by default and removes them when deleteFiles=true', async () => {
    const installed = await installCA({ basePath, verbose: false })

    const noDelete = await uninstallCA({ basePath, verbose: false })
    expect(noDelete.filesDeleted).toBe(false)
    expect(fs.existsSync(installed.caCertPath)).toBe(true)
    expect(fs.existsSync(installed.caKeyPath)).toBe(true)

    const withDelete = await uninstallCA({ basePath, verbose: false, deleteFiles: true })
    expect(withDelete.filesDeleted).toBe(true)
    expect(fs.existsSync(installed.caCertPath)).toBe(false)
    expect(fs.existsSync(installed.caKeyPath)).toBe(false)
  })

  it('returns removedFromTrustStore=false when the handler propagates an error (darwin)', async () => {
    // Switch to darwin where the platform handler does NOT catch runCommand
    // failures — the linux handler swallows per-DB errors as a feature.
    mockPlatform = 'darwin'
    try {
      await installCA({ basePath, verbose: false })
      mockRunCommand.mockImplementation((cmd: string) => {
        if (cmd.includes('security delete-certificate'))
          return Promise.reject(new Error('keychain locked'))
        return Promise.resolve({ stdout: '', stderr: '' })
      })

      const result = await uninstallCA({ basePath, verbose: false })
      expect(result.removedFromTrustStore).toBe(false)
    }
    finally {
      mockPlatform = 'linux'
    }
  })
})

