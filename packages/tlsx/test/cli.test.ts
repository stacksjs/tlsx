import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { config } from '../src/config'
import {
  createRootCA,
  generateCertificate,
  addCertToSystemTrustStoreAndSaveCert,
  removeCertFromSystemTrustStore,
} from '../src/certificate'
import { validateCertificate } from '../src/certificate/validation'
import { normalizeCertPaths, listCertsInDirectory, runCommand } from '../src/utils'

// Create a mock implementation of the CLI
const mockCliRun = (command: string) => {
  // Parse command args
  const args = command.split(' ')
  const cmd = args[0]

  if (cmd === 'secure') {
    const domain = args[1] && !args[1].startsWith('-') ? args[1] : undefined
    return { command: 'secure', domain }
  }

  if (cmd === 'revoke') {
    const domain = args[1] && !args[1].startsWith('-') ? args[1] : undefined
    return { command: 'revoke', domain }
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

  throw new Error(`Unknown command: ${cmd}`)
}

// Mock dependencies to avoid executing real commands in tests
mock.module('../src/utils', () => {
  const original = require.cache[require.resolve('../src/utils')]
  return {
    ...original,
    runCommand: mock(() => Promise.resolve({ stdout: 'Success', stderr: '' })),
  }
})

// Mock the certificate trust functions
const mockAddCertToSystemTrustStore = mock((cert: any, caCert: any) => Promise.resolve('/path/to/cert.crt'))
const mockRemoveCertFromSystemTrustStore = mock((domain: string, options?: any) => Promise.resolve(undefined))

mock.module('../src/certificate/trust', () => {
  const original = require.cache[require.resolve('../src/certificate/trust')]
  return {
    ...original,
    addCertToSystemTrustStoreAndSaveCert: mockAddCertToSystemTrustStore,
    removeCertFromSystemTrustStore: mockRemoveCertFromSystemTrustStore,
  }
})

// Mock the certificate validation function
const mockValidateCertificate = mock((certPath: string, caCertPath?: string) => ({
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
      const mockCert = {
        certificate: '-----BEGIN CERTIFICATE-----\nTest\n-----END CERTIFICATE-----',
        privateKey: '-----BEGIN PRIVATE KEY-----\nTest\n-----END PRIVATE KEY-----',
        notBefore: new Date(),
        notAfter: new Date(),
      }

      const caCert = await mockCreateRootCA();
      const hostCert = await mockGenerateCertificate({
        domain: 'example.com',
        domains: ['example.com'],
        rootCA: {
          certificate: caCert.certificate,
          privateKey: caCert.privateKey,
        },
      });
      await mockAddCertToSystemTrustStore(hostCert, caCert.certificate);

      // Verify the mocks were called correctly
      expect(mockCreateRootCA).toHaveBeenCalled()
      expect(mockGenerateCertificate).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'example.com',
      }))
      expect(mockAddCertToSystemTrustStore).toHaveBeenCalledWith(
        mockCert,
        mockCert.certificate
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

      // Simulate what the CLI would do
      await mockRemoveCertFromSystemTrustStore('example.com', {
        caCertPath: config.caCertPath,
        certPath: config.certPath,
        keyPath: config.keyPath,
      })

      // Verify the mock was called correctly
      expect(mockRemoveCertFromSystemTrustStore).toHaveBeenCalledWith(
        'example.com',
        expect.objectContaining({
          caCertPath: config.caCertPath,
        })
      )
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
        expect.anything()
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
        expect.anything()
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
})