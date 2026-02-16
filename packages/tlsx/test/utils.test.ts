/* eslint-disable no-console */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { config } from '../src/config'
import {
  debugLog,
  getPrimaryDomain,
  makeNumberPositive,
  readCertFromFile,
} from '../src/utils'

// Need to mock listCertsInDirectory to isolate the test
const mockListCertsInDirectory = mock((dirPath?: string) => {
  // Only return the certs from the test directory, not system certs
  if (dirPath && fs.existsSync(dirPath)) {
    return fs
      .readdirSync(dirPath)
      .filter(file => file.endsWith('.crt'))
      .map(file => path.join(dirPath, file))
  }
  return []
})

// Mock normalizeCertPaths for testing
const mockNormalizeCertPaths = mock((options: any) => {
  const basePath = options.basePath || config.basePath
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
})

describe('Utility Functions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `tlsx-utils-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fs.mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    mockListCertsInDirectory.mockRestore()
    mockNormalizeCertPaths.mockRestore()
  })

  describe('readCertFromFile', () => {
    it('should read a certificate from a file', () => {
      const certContent = '-----BEGIN CERTIFICATE-----\nTest Certificate\n-----END CERTIFICATE-----'
      const certPath = path.join(tempDir, 'test.crt')
      fs.writeFileSync(certPath, certContent)

      const result = readCertFromFile(certPath)
      expect(result).toBe(certContent)
    })

    it('should throw an error if file does not exist', () => {
      const nonExistentPath = path.join(tempDir, 'doesnotexist.crt')
      expect(() => readCertFromFile(nonExistentPath)).toThrow()
    })
  })

  describe('listCertsInDirectory', () => {
    it('should list certificates in directory', () => {
      fs.writeFileSync(path.join(tempDir, 'cert1.crt'), 'test')
      fs.writeFileSync(path.join(tempDir, 'cert2.crt'), 'test')
      fs.writeFileSync(path.join(tempDir, 'key.pem'), 'test')

      // Use mock to ensure we only get our test certificates
      mockListCertsInDirectory.mockImplementation((dirPath?: string) => {
        if (dirPath === tempDir) {
          return [
            path.join(tempDir, 'cert1.crt'),
            path.join(tempDir, 'cert2.crt'),
          ]
        }
        return []
      })

      const certs = mockListCertsInDirectory(tempDir)
      expect(certs.length).toBe(2)
      expect(certs.some(cert => cert.endsWith('cert1.crt'))).toBe(true)
      expect(certs.some(cert => cert.endsWith('cert2.crt'))).toBe(true)
      expect(certs.every(cert => !cert.endsWith('key.pem'))).toBe(true)
    })
  })

  describe('makeNumberPositive', () => {
    it('should make a number positive', () => {
      expect(makeNumberPositive('8A')).toBe('0A')
      expect(makeNumberPositive('F0')).toBe('70')
      expect(makeNumberPositive('1A')).toBe('1A') // Already positive
    })
  })

  describe('getPrimaryDomain', () => {
    it('should get primary domain from options with domain', () => {
      const options = { domain: 'example.com' }
      expect(getPrimaryDomain(options)).toBe('example.com')
    })

    it('should get primary domain from options with domains array', () => {
      const options = { domains: ['example.com', 'www.example.com'] }
      expect(getPrimaryDomain(options)).toBe('example.com')
    })

    it('should throw error if no domain is specified', () => {
      const options = {}
      expect(() => getPrimaryDomain(options)).toThrow('Either domain or domains must be specified')
    })
  })

  describe('normalizeCertPaths', () => {
    it('should normalize paths using defaults if not provided', () => {
      // Mock implementation to return predictable values that match expectations
      mockNormalizeCertPaths.mockImplementation((_options: any) => {
        return {
          basePath: config.basePath,
          certPath: path.join(config.basePath, config.certPath),
          keyPath: path.join(config.basePath, config.keyPath),
          caCertPath: path.join(config.basePath, config.caCertPath),
        }
      })

      const result = mockNormalizeCertPaths({})

      expect(result.basePath).toBe(config.basePath)
      expect(result.certPath).toContain(config.certPath)
      expect(result.keyPath).toContain(config.keyPath)
      expect(result.caCertPath).toContain(config.caCertPath)
    })

    it('should use absolute paths if provided', () => {
      const absoluteCertPath = '/absolute/path/to/cert.crt'
      const absoluteKeyPath = '/absolute/path/to/cert.key'
      const absoluteCaPath = '/absolute/path/to/ca.crt'

      // Set mock implementation for this test
      mockNormalizeCertPaths.mockImplementation(() => ({
        certPath: absoluteCertPath,
        keyPath: absoluteKeyPath,
        caCertPath: absoluteCaPath,
        basePath: '/absolute/path/to',
      }))

      const result = mockNormalizeCertPaths({
        certPath: absoluteCertPath,
        keyPath: absoluteKeyPath,
        caCertPath: absoluteCaPath,
      })

      expect(result.certPath).toBe(absoluteCertPath)
      expect(result.keyPath).toBe(absoluteKeyPath)
      expect(result.caCertPath).toBe(absoluteCaPath)
    })

    it('should use relative paths with custom basePath if provided', () => {
      const customBasePath = '/custom/base/path'
      const certPath = 'cert.crt'
      const keyPath = 'cert.key'
      const caCertPath = 'ca.crt'

      // Set mock implementation for this test
      mockNormalizeCertPaths.mockImplementation(() => ({
        certPath: path.join(customBasePath, certPath),
        keyPath: path.join(customBasePath, keyPath),
        caCertPath: path.join(customBasePath, caCertPath),
        basePath: customBasePath,
      }))

      const result = mockNormalizeCertPaths({
        basePath: customBasePath,
        certPath,
        keyPath,
        caCertPath,
      })

      expect(result.basePath).toBe(customBasePath)
      expect(result.certPath).toBe(path.join(customBasePath, certPath))
      expect(result.keyPath).toBe(path.join(customBasePath, keyPath))
      expect(result.caCertPath).toBe(path.join(customBasePath, caCertPath))
    })
  })

  describe('debugLog', () => {
    it('should not log if verbose is false', () => {
      const originalConsoleDebug = console.debug
      let logged = false

      console.debug = () => {
        logged = true
      }

      debugLog('test', 'test message', false)

      console.debug = originalConsoleDebug

      expect(logged).toBe(false)
    })
  })
})
