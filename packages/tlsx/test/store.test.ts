import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { storeCertificate, storeCACertificate } from '../src/certificate/store'
import { normalizeCertPaths } from '../src/utils'

// Mock the normalizeCertPaths function
mock.module('../src/utils', () => {
  const original = require.cache[require.resolve('../src/utils')]
  return {
    ...original,
    // Add custom normalizeCertPaths implementation for testing
    normalizeCertPaths: mock((options: any) => {
      const basePath = options.basePath || '/mock/base/path'
      const certPath = options.certPath
        ? path.isAbsolute(options.certPath)
          ? options.certPath
          : path.join(basePath, options.certPath)
        : path.join(basePath, 'default.crt')

      const keyPath = options.keyPath
        ? path.isAbsolute(options.keyPath)
          ? options.keyPath
          : path.join(basePath, options.keyPath)
        : path.join(basePath, 'default.key')

      const caCertPath = options.caCertPath
        ? path.isAbsolute(options.caCertPath)
          ? options.caCertPath
          : path.join(basePath, options.caCertPath)
        : path.join(basePath, 'ca.crt')

      return {
        certPath,
        keyPath,
        caCertPath,
        basePath,
      }
    }),
  }
})

describe('Certificate Storage', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `tlsx-store-test-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('storeCertificate', () => {
    it('should store a certificate and private key', () => {
      // Create a mock certificate
      const cert = {
        certificate: '-----BEGIN CERTIFICATE-----\nTest Certificate\n-----END CERTIFICATE-----',
        privateKey: '-----BEGIN PRIVATE KEY-----\nTest Private Key\n-----END PRIVATE KEY-----',
      }

      // Use real paths for actual file writing
      const certPath = path.join(tempDir, 'test.crt')
      const keyPath = path.join(tempDir, 'test.key')

      // Use absolute paths to ensure they don't get modified
      const result = storeCertificate(cert, {
        certPath,
        keyPath,
        verbose: true,
      })

      // Check if files exist
      expect(fs.existsSync(certPath)).toBe(true)
      expect(fs.existsSync(keyPath)).toBe(true)

      // Check file contents
      expect(fs.readFileSync(certPath, 'utf8')).toBe(cert.certificate)
      expect(fs.readFileSync(keyPath, 'utf8')).toBe(cert.privateKey)

      // Check return value is the cert path
      expect(result).toBe(certPath)
    })

    it('should create directories if they do not exist', () => {
      // Create a mock certificate
      const cert = {
        certificate: '-----BEGIN CERTIFICATE-----\nTest Certificate\n-----END CERTIFICATE-----',
        privateKey: '-----BEGIN PRIVATE KEY-----\nTest Private Key\n-----END PRIVATE KEY-----',
      }

      // Use nested paths that don't exist yet
      const nestedDir = path.join(tempDir, 'nested', 'dirs')
      const certPath = path.join(nestedDir, 'test.crt')
      const keyPath = path.join(nestedDir, 'test.key')

      storeCertificate(cert, {
        certPath,
        keyPath,
      })

      // Check if directories and files were created
      expect(fs.existsSync(nestedDir)).toBe(true)
      expect(fs.existsSync(certPath)).toBe(true)
      expect(fs.existsSync(keyPath)).toBe(true)
    })
  })

  describe('storeCACertificate', () => {
    it('should store a CA certificate', () => {
      // Create a mock CA certificate
      const caCert = '-----BEGIN CERTIFICATE-----\nTest CA Certificate\n-----END CERTIFICATE-----'

      // Use real path for actual file writing
      const caCertPath = path.join(tempDir, 'ca.crt')

      // Store the CA certificate
      const result = storeCACertificate(caCert, {
        caCertPath,
        verbose: true,
      })

      // Check if file exists
      expect(fs.existsSync(caCertPath)).toBe(true)

      // Check file content
      expect(fs.readFileSync(caCertPath, 'utf8')).toBe(caCert)

      // Check return value is the cert path
      expect(result).toBe(caCertPath)
    })

    it('should create directory if it does not exist', () => {
      // Create a mock CA certificate
      const caCert = '-----BEGIN CERTIFICATE-----\nTest CA Certificate\n-----END CERTIFICATE-----'

      // Use nested path that doesn't exist yet
      const nestedDir = path.join(tempDir, 'nested', 'ca', 'dir')
      const caCertPath = path.join(nestedDir, 'ca.crt')

      storeCACertificate(caCert, {
        caCertPath,
      })

      // Check if directory and file were created
      expect(fs.existsSync(nestedDir)).toBe(true)
      expect(fs.existsSync(caCertPath)).toBe(true)
    })
  })
})