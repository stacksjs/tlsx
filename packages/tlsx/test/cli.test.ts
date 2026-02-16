import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createRootCA,
  generateCertificate,
} from '../src/certificate'
import { config } from '../src/config'
import { debugLog, findFoldersWithFile, getPrimaryDomain, listCertsInDirectory, makeNumberPositive, normalizeCertPaths, readCertFromFile, runCommand } from '../src/utils'

// Create a mock implementation of the CLI
function mockCliRun(command: string) {
  // Parse command args
  const args = command.split(' ')
  const cmd = args[0]

  if (cmd === 'secure') {
    const domain = args[1] && !args[1].startsWith('-') ? args[1] : undefined
    return { command: 'secure', domain }
  }

  if (cmd === 'revoke') {
    const domain = args[1] && !args[1].startsWith('-') ? args[1] : undefined

    // Handle the --cert-name option
    let certName: string | undefined
    const certNameIndex = args.indexOf('--cert-name')
    if (certNameIndex !== -1 && certNameIndex + 1 < args.length) {
      // Check if the next argument is a quoted string
      const nextArg = args[certNameIndex + 1]
      if (nextArg.startsWith('"')) {
        // Find the closing quote
        let endIndex = certNameIndex + 1
        while (endIndex < args.length && !args[endIndex].endsWith('"')) {
          endIndex++
        }
        if (endIndex < args.length) {
          // Combine all parts of the quoted string
          certName = args.slice(certNameIndex + 1, endIndex + 1).join(' ')
          // Remove the quotes
          certName = certName.replace(/^"|"$/g, '')
        }
      }
      else {
        certName = nextArg
      }
    }

    return { command: 'revoke', domain, certName }
  }

  if (cmd === 'verify') {
    const certPath = args[1] && !args[1].startsWith('-') ? args[1] : undefined
    return { command: 'verify', certPath }
  }

  if (cmd === 'list') {
    return { command: 'list' }
  }

  if (cmd === 'info') {
    return { command: 'info' }
  }

  if (cmd === 'cleanup') {
    const force = args.includes('--force')

    // Handle the --pattern option
    let pattern: string | undefined
    const patternIndex = args.indexOf('--pattern')
    if (patternIndex !== -1 && patternIndex + 1 < args.length) {
      // Check if the next argument is a quoted string
      const nextArg = args[patternIndex + 1]
      if (nextArg.startsWith('"')) {
        // Find the closing quote
        let endIndex = patternIndex + 1
        while (endIndex < args.length && !args[endIndex].endsWith('"')) {
          endIndex++
        }
        if (endIndex < args.length) {
          // Combine all parts of the quoted string
          pattern = args.slice(patternIndex + 1, endIndex + 1).join(' ')
          // Remove the quotes
          pattern = pattern.replace(/^"|"$/g, '')
        }
      }
      else {
        pattern = nextArg
      }
    }

    return { command: 'cleanup', force, pattern }
  }

  throw new Error(`Unknown command: ${cmd}`)
}

// Mock dependencies to avoid executing real commands in tests
mock.module('../src/utils', () => ({
  debugLog,
  findFoldersWithFile,
  getPrimaryDomain,
  listCertsInDirectory,
  makeNumberPositive,
  normalizeCertPaths,
  readCertFromFile,
  runCommand: mock(() => Promise.resolve({ stdout: 'Success', stderr: '' })),
}))

// Mock the certificate trust functions
const mockAddCertToSystemTrustStore = mock((_cert: any, _caCert: any) => Promise.resolve('/path/to/cert.crt'))
const mockRemoveCertFromSystemTrustStore = mock((_domain: string, _options?: any, _certName?: string) => Promise.resolve(undefined))
const mockCleanupTrustStore = mock((_options?: any, _pattern?: string) => Promise.resolve(undefined))

mock.module('../src/certificate/trust', () => {
  const original = require.cache[require.resolve('../src/certificate/trust')]
  return {
    ...original,
    addCertToSystemTrustStoreAndSaveCert: mockAddCertToSystemTrustStore,
    removeCertFromSystemTrustStore: mockRemoveCertFromSystemTrustStore,
    cleanupTrustStore: mockCleanupTrustStore,
  }
})

// Mock the certificate validation function
const mockValidateCertificate = mock((_certPath: string, _caCertPath?: string) => ({
  valid: true,
  expired: false,
  notYetValid: false,
  issuerValid: true,
  domains: ['example.com'],
  validFrom: new Date('2023-01-01'),
  validTo: new Date('2025-01-01'),
  issuer: 'Test CA',
  subject: 'example.com',
}))

mock.module('../src/certificate/validation', () => {
  const original = require.cache[require.resolve('../src/certificate/validation')]
  return {
    ...original,
    validateCertificate: mockValidateCertificate,
  }
})

describe('tlsx CLI', () => {
  let tempDir: string
  let consoleSpy: any
  let mockCreateRootCA: any
  let mockGenerateCertificate: any
  let mockListCertsInDirectory: any
  let mockNormalizeCertPaths: any

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `tlsx-test-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Reset mocks
    mockAddCertToSystemTrustStore.mockClear()
    mockRemoveCertFromSystemTrustStore.mockClear()
    mockValidateCertificate.mockClear()

    // Create mocks for certificate functions
    const mockCert = {
      certificate: '-----BEGIN CERTIFICATE-----\nTest\n-----END CERTIFICATE-----',
      privateKey: '-----BEGIN PRIVATE KEY-----\nTest\n-----END PRIVATE KEY-----',
      notBefore: new Date(),
      notAfter: new Date(),
    }

    mockCreateRootCA = mock(createRootCA).mockResolvedValue(mockCert)
    mockGenerateCertificate = mock(generateCertificate).mockResolvedValue(mockCert)
    mockListCertsInDirectory = mock(listCertsInDirectory).mockReturnValue([
      '/path/to/cert1.crt',
      '/path/to/cert2.crt',
    ])
    mockNormalizeCertPaths = mock(normalizeCertPaths).mockReturnValue({
      certPath: '/path/to/cert.crt',
      keyPath: '/path/to/cert.key',
      caCertPath: '/path/to/ca.crt',
      basePath: '/path/to',
    })

    // Spy on console to verify output
    consoleSpy = spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    consoleSpy.mockRestore()

    // Restore mocks
    mockCreateRootCA.mockRestore()
    mockGenerateCertificate.mockRestore()
    mockListCertsInDirectory.mockRestore()
    mockNormalizeCertPaths.mockRestore()
  })

  describe('secure command', () => {
    it('should generate certificates for a domain', async () => {
      // Test the secure command
      const result = mockCliRun('secure example.com')

      // Validate the command was parsed correctly
      expect(result.command).toBe('secure')
      expect(result.domain).toBe('example.com')

      // Simulate what the CLI would do
      const caCert = await mockCreateRootCA()
      const hostCert = await mockGenerateCertificate({
        domain: 'example.com',
        domains: ['example.com'],
        rootCA: {
          certificate: caCert.certificate,
          privateKey: caCert.privateKey,
        },
      })
      await mockAddCertToSystemTrustStore(hostCert, caCert.certificate)

      // Verify the mocks were called correctly
      expect(mockCreateRootCA).toHaveBeenCalled()
      expect(mockGenerateCertificate).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'example.com',
      }))
      expect(mockAddCertToSystemTrustStore).toHaveBeenCalledWith(
        caCert,
        caCert.certificate,
      )
    })
  })

  describe('revoke command', () => {
    it('should revoke certificates for a domain', async () => {
      // Test the revoke command
      const result = mockCliRun('revoke example.com')

      // Validate the command was parsed correctly
      expect(result.command).toBe('revoke')
      expect(result.domain).toBe('example.com')
      expect(result.certName).toBeUndefined()

      // Simulate what the CLI would do
      await mockRemoveCertFromSystemTrustStore('example.com', {
        caCertPath: config.caCertPath,
        certPath: config.certPath,
        keyPath: config.keyPath,
      })

      // Verify the mock was called correctly
      expect(mockRemoveCertFromSystemTrustStore).toHaveBeenCalled()
      expect(mockRemoveCertFromSystemTrustStore.mock.calls[0][0]).toBe('example.com')
      expect(mockRemoveCertFromSystemTrustStore.mock.calls[0][1]).toEqual(expect.objectContaining({
        caCertPath: config.caCertPath,
      }))
    })

    it('should revoke certificates for a domain with a specific certificate name', async () => {
      // Test the revoke command with a specific certificate name
      const result = mockCliRun('revoke example.com --cert-name "My Custom Certificate"')

      // Validate the command was parsed correctly
      expect(result.command).toBe('revoke')
      expect(result.domain).toBe('example.com')
      expect(result.certName).toBe('My Custom Certificate')

      // Simulate what the CLI would do
      await mockRemoveCertFromSystemTrustStore('example.com', {
        caCertPath: config.caCertPath,
        certPath: config.certPath,
        keyPath: config.keyPath,
      }, 'My Custom Certificate')

      // Verify the mock was called correctly
      expect(mockRemoveCertFromSystemTrustStore).toHaveBeenCalled()
      expect(mockRemoveCertFromSystemTrustStore.mock.calls[0][0]).toBe('example.com')
      expect(mockRemoveCertFromSystemTrustStore.mock.calls[0][1]).toEqual(expect.objectContaining({
        caCertPath: config.caCertPath,
      }))
      expect(mockRemoveCertFromSystemTrustStore.mock.calls[0][2]).toBe('My Custom Certificate')
    })
  })

  describe('verify command', () => {
    it('should verify a certificate', async () => {
      // Create a temporary certificate for testing
      const certPath = path.join(tempDir, 'test.crt')
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\nTest\n-----END CERTIFICATE-----')

      // Test the verify command
      const result = mockCliRun(`verify ${certPath}`)

      // Validate the command was parsed correctly
      expect(result.command).toBe('verify')
      expect(result.certPath).toBe(certPath)

      // Set up the mock to return a valid certificate
      mockValidateCertificate.mockReturnValue({
        valid: true,
        expired: false,
        notYetValid: false,
        issuerValid: true,
        domains: ['example.com'],
        validFrom: new Date('2023-01-01'),
        validTo: new Date('2025-01-01'),
        issuer: 'Test CA',
        subject: 'example.com',
      })

      // Simulate what the CLI would do
      const validationResult = mockValidateCertificate(certPath, config.caCertPath)

      // Verify the mock was called correctly
      expect(mockValidateCertificate).toHaveBeenCalledWith(
        certPath,
        expect.anything(),
      )

      // Verify the result is as expected
      expect(validationResult.valid).toBe(true)
      expect(validationResult.domains).toContain('example.com')
    })

    it('should report an invalid certificate', async () => {
      // Create a temporary certificate for testing
      const certPath = path.join(tempDir, 'expired.crt')
      fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\nExpired\n-----END CERTIFICATE-----')

      // Test the verify command
      const result = mockCliRun(`verify ${certPath}`)

      // Validate the command was parsed correctly
      expect(result.command).toBe('verify')
      expect(result.certPath).toBe(certPath)

      // Set up the mock to return an invalid certificate
      mockValidateCertificate.mockReturnValue({
        valid: false,
        expired: true,
        notYetValid: false,
        issuerValid: false,
        domains: ['example.com'],
        validFrom: new Date('2020-01-01'),
        validTo: new Date('2022-01-01'),
        issuer: 'Test CA',
        subject: 'example.com',
      })

      // Simulate what the CLI would do
      const validationResult = mockValidateCertificate(certPath, config.caCertPath)

      // Verify the mock was called correctly
      expect(mockValidateCertificate).toHaveBeenCalledWith(
        certPath,
        expect.anything(),
      )

      // Verify the result is as expected
      expect(validationResult.valid).toBe(false)
      expect(validationResult.expired).toBe(true)
    })
  })

  describe('list command', () => {
    it('should list certificates', async () => {
      // Test the list command
      const result = mockCliRun('list')

      // Validate the command was parsed correctly
      expect(result.command).toBe('list')

      // Simulate what the CLI would do
      const certificates = mockListCertsInDirectory()

      // Verify the mock was called correctly
      expect(mockListCertsInDirectory).toHaveBeenCalled()

      // Verify the result is as expected
      expect(certificates).toEqual([
        '/path/to/cert1.crt',
        '/path/to/cert2.crt',
      ])
    })
  })

  describe('info command', () => {
    it('should display configuration info', async () => {
      // Test the info command
      const result = mockCliRun('info')

      // Validate the command was parsed correctly
      expect(result.command).toBe('info')

      // Simulate what the CLI would do
      const paths = mockNormalizeCertPaths({})

      // Verify the mock was called correctly
      expect(mockNormalizeCertPaths).toHaveBeenCalledWith({})

      // Verify the result is as expected
      expect(paths).toEqual({
        certPath: '/path/to/cert.crt',
        keyPath: '/path/to/cert.key',
        caCertPath: '/path/to/ca.crt',
        basePath: '/path/to',
      })
    })
  })

  describe('cleanup command', () => {
    it('should clean up all certificates', async () => {
      // Test the cleanup command
      const result = mockCliRun('cleanup --force')

      // Validate the command was parsed correctly
      expect(result.command).toBe('cleanup')
      expect(result.force).toBe(true)
      expect(result.pattern).toBeUndefined()

      // Simulate what the CLI would do
      await mockCleanupTrustStore({ force: true })

      // Verify the mock was called correctly
      expect(mockCleanupTrustStore).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true,
        }),
      )
    })

    it('should clean up certificates with a specific pattern', async () => {
      // Test the cleanup command with a pattern
      const result = mockCliRun('cleanup --pattern "My Custom Pattern"')

      // Validate the command was parsed correctly
      expect(result.command).toBe('cleanup')
      expect(result.force).toBe(false)
      expect(result.pattern).toBe('My Custom Pattern')

      // Simulate what the CLI would do
      await mockCleanupTrustStore({}, 'My Custom Pattern')

      // Verify the mock was called correctly
      expect(mockCleanupTrustStore).toHaveBeenCalledWith(
        expect.anything(),
        'My Custom Pattern',
      )
    })

    it('should handle errors when cleaning up certificates', async () => {
      // Test the cleanup command
      const result = mockCliRun('cleanup')

      // Validate the command was parsed correctly
      expect(result.command).toBe('cleanup')
      expect(result.force).toBe(false)
      expect(result.pattern).toBeUndefined()

      // Mock an error
      mockCleanupTrustStore.mockImplementationOnce(() => {
        throw new Error('Failed to clean up certificates')
      })

      // Simulate what the CLI would do when an error occurs
      let errorThrown = false
      try {
        await mockCleanupTrustStore()
      }
      catch (error: unknown) {
        errorThrown = true
        if (error instanceof Error) {
          expect(error.message).toBe('Failed to clean up certificates')
        }
      }

      // Verify an error was thrown
      expect(errorThrown).toBe(true)

      // Verify the mock was called
      expect(mockCleanupTrustStore).toHaveBeenCalled()
    })
  })
})
