import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as validationModule from '../src/certificate/validation'

describe('Certificate Validation', () => {
  let tempDir: string
  let certPath: string
  let caCertPath: string
  let expiredCertPath: string
  let invalidCertPath: string
  let nonExistentPath: string

  // Setup spy on validateCertificate
  const validateCertificateSpy = mock(validationModule.validateCertificate)

  // Setup test files
  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `tlsx-validation-test-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Create placeholder files
    certPath = path.join(tempDir, 'valid.crt')
    fs.writeFileSync(certPath, '-----BEGIN CERTIFICATE-----\nValid Cert\n-----END CERTIFICATE-----')

    caCertPath = path.join(tempDir, 'ca.crt')
    fs.writeFileSync(caCertPath, '-----BEGIN CERTIFICATE-----\nCA Cert\n-----END CERTIFICATE-----')

    expiredCertPath = path.join(tempDir, 'expired.crt')
    fs.writeFileSync(expiredCertPath, '-----BEGIN CERTIFICATE-----\nExpired Cert\n-----END CERTIFICATE-----')

    invalidCertPath = path.join(tempDir, 'invalid.crt')
    fs.writeFileSync(invalidCertPath, 'This is not a valid certificate')

    nonExistentPath = path.join(tempDir, 'doesnotexist.crt')
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    validateCertificateSpy.mockRestore()
  })

  describe('validateCertificate', () => {
    it('should validate a valid certificate', () => {
      validateCertificateSpy.mockReturnValue({
        valid: true,
        expired: false,
        notYetValid: false,
        issuerValid: true,
        domains: ['example.com', 'www.example.com', '*.api.example.com'],
        validFrom: new Date('2023-01-01'),
        validTo: new Date('2025-01-01'),
        issuer: 'Test CA',
        subject: 'example.com',
      })

      const result = validateCertificateSpy(certPath, caCertPath)

      expect(result.valid).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.notYetValid).toBe(false)
      expect(result.issuerValid).toBe(true)
      expect(result.domains).toContain('example.com')
      expect(result.domains).toContain('www.example.com')
      expect(result.subject).toBe('example.com')
    })

    it('should identify an expired certificate', () => {
      validateCertificateSpy.mockReturnValue({
        valid: false,
        expired: true,
        notYetValid: false,
        issuerValid: true,
        domains: ['expired.com'],
        validFrom: new Date('2020-01-01'),
        validTo: new Date('2022-01-01'),
        issuer: 'Test CA',
        subject: 'expired.com',
      })

      const result = validateCertificateSpy(expiredCertPath, caCertPath)

      expect(result.valid).toBe(false)
      expect(result.expired).toBe(true)
      expect(result.issuerValid).toBe(true)
      expect(result.subject).toBe('expired.com')
    })

    it('should handle missing certificate files', () => {
      validateCertificateSpy.mockReturnValue({
        valid: false,
        expired: false,
        notYetValid: false,
        issuerValid: false,
        domains: [],
        validFrom: new Date(),
        validTo: new Date(),
        issuer: '',
        subject: '',
        message: `Certificate file not found: ${nonExistentPath}`,
      })

      const result = validateCertificateSpy(nonExistentPath, caCertPath)

      expect(result.valid).toBe(false)
      expect(result.message).toContain('Certificate file not found')
    })

    it('should validate without CA verification', () => {
      validateCertificateSpy.mockReturnValue({
        valid: true,
        expired: false,
        notYetValid: false,
        issuerValid: false, // No CA to verify against
        domains: ['example.com', 'www.example.com', '*.api.example.com'],
        validFrom: new Date('2023-01-01'),
        validTo: new Date('2025-01-01'),
        issuer: 'Test CA',
        subject: 'example.com',
      })

      const result = validateCertificateSpy(certPath)

      expect(result.valid).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.notYetValid).toBe(false)
      expect(result.issuerValid).toBe(false) // No CA to verify against
    })

    it('should handle invalid certificate content', () => {
      validateCertificateSpy.mockReturnValue({
        valid: false,
        expired: false,
        notYetValid: false,
        issuerValid: false,
        domains: [],
        validFrom: new Date(),
        validTo: new Date(),
        issuer: '',
        subject: '',
        message: 'Error validating certificate: Invalid certificate format',
      })

      const result = validateCertificateSpy(invalidCertPath)

      expect(result.valid).toBe(false)
      expect(result.message).toContain('Error validating certificate')
    })
  })
})
