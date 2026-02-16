import type { CAOptions, Certificate, CertificateOptions } from '../src/types'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRootCA, generateCertificate, getCertificateFromCertPemOrPath, isCertExpired, isCertValidForDomain, listCertsInDirectory, parseCertDetails } from '../src'

describe('@stacksjs/tlsx', () => {
  let rootCA: Certificate

  beforeAll(async () => {
    rootCA = await createRootCA()
  })

  it('should create a Root CA certificate', () => {
    expect(rootCA).toHaveProperty('certificate')
    expect(rootCA).toHaveProperty('privateKey')
    expect(rootCA).toHaveProperty('notBefore')
    expect(rootCA).toHaveProperty('notAfter')
  })

  it('should generate a host certificate', async () => {
    const options: CertificateOptions = {
      hostCertCN: 'localhost',
      domain: 'localhost',
      rootCA: {
        certificate: rootCA.certificate,
        privateKey: rootCA.privateKey,
      },
    }
    const hostCert = await generateCertificate(options)
    expect(hostCert).toHaveProperty('certificate')
    expect(hostCert).toHaveProperty('privateKey')
    expect(hostCert).toHaveProperty('notBefore')
    expect(hostCert).toHaveProperty('notAfter')
  })

  it('should validate a certificate for a domain', async () => {
    const options: CertificateOptions = {
      hostCertCN: 'localhost',
      domain: 'localhost',
      rootCA: {
        certificate: rootCA.certificate,
        privateKey: rootCA.privateKey,
      },
    }
    const hostCert = await generateCertificate(options)
    const isValid = isCertValidForDomain(hostCert.certificate, 'localhost')
    expect(isValid).toBe(true)
  })

  it('should parse certificate details', () => {
    const certDetails = parseCertDetails(rootCA.certificate)
    expect(certDetails).toHaveProperty('subject')
    expect(certDetails).toHaveProperty('issuer')
    expect(certDetails).toHaveProperty('validFrom')
    expect(certDetails).toHaveProperty('validTo')
    expect(certDetails).toHaveProperty('serialNumber')
  })

  it('should check if a certificate is expired', () => {
    const isExpired = isCertExpired(rootCA.certificate)
    expect(isExpired).toBe(false)
  })

  it('should generate a certificate with multiple domains', async () => {
    const options: CertificateOptions = {
      hostCertCN: 'example.com',
      domain: 'example.com',
      domains: ['sub1.example.com', 'sub2.example.com'],
      rootCA: {
        certificate: rootCA.certificate,
        privateKey: rootCA.privateKey,
      },
    }
    const hostCert = await generateCertificate(options)
    expect(hostCert).toHaveProperty('certificate')

    // Verify each domain is valid
    expect(isCertValidForDomain(hostCert.certificate, 'example.com')).toBe(true)
    expect(isCertValidForDomain(hostCert.certificate, 'sub1.example.com')).toBe(true)
    expect(isCertValidForDomain(hostCert.certificate, 'sub2.example.com')).toBe(true)
    expect(isCertValidForDomain(hostCert.certificate, 'invalid.example.com')).toBe(false)
  })

  it('should generate a certificate with IP addresses and URIs', async () => {
    const options: CertificateOptions = {
      hostCertCN: 'localhost',
      domain: 'localhost',
      altNameIPs: ['127.0.0.1', '::1'],
      altNameURIs: ['https://localhost/app'],
      rootCA: {
        certificate: rootCA.certificate,
        privateKey: rootCA.privateKey,
      },
    }
    const hostCert = await generateCertificate(options)
    const cert = getCertificateFromCertPemOrPath(hostCert.certificate)
    const san = cert.subjectAltName || ''

    expect(san).toContain('IP Address:127.0.0.1')
    expect(san).toContain('IP Address:0:0:0:0:0:0:0:1')
    expect(san).toContain('URI:https://localhost/app')
  })

  it('should generate a certificate with custom validity period', async () => {
    const validityYears = 1
    const customCA = await createRootCA({
      validityYears,
      organization: 'Test CA',
      commonName: 'Test Root CA',
    } as CAOptions)
    const now = new Date()

    // The certificate should be valid from now
    expect(customCA.notBefore.getTime()).toBeLessThanOrEqual(now.getTime())

    // The certificate should be valid for roughly validityYears (with some buffer for test execution)
    const expectedValidityMs = validityYears * 365 * 24 * 60 * 60 * 1000
    const actualValidityMs = customCA.notAfter.getTime() - customCA.notBefore.getTime()
    const tolerance = 7 * 24 * 60 * 60 * 1000 // 7 days tolerance for leap years

    expect(Math.abs(actualValidityMs - expectedValidityMs)).toBeLessThan(tolerance)
  })

  it('should generate a certificate with custom organization details', async () => {
    const customOrg: CAOptions = {
      organization: 'Test Corp',
      organizationalUnit: 'Test Unit',
      countryName: 'US',
      stateName: 'California',
      localityName: 'Playa Vista',
      commonName: 'Test Root CA',
    }

    const customCA = await createRootCA(customOrg)
    const details = parseCertDetails(customCA.certificate)
    const subject = details.subject

    // Check each field in the subject
    const orgField = subject.find((field: { shortName: string, value: string }) => field.shortName === 'O')
    expect(orgField?.value).toBe('Test Corp')

    const countryField = subject.find((field: { shortName: string, value: string }) => field.shortName === 'C')
    expect(countryField?.value).toBe('US')

    const stateField = subject.find((field: { shortName: string, value: string }) => field.shortName === 'ST')
    expect(stateField?.value).toBe('California')

    const localityField = subject.find((field: { shortName: string, value: string }) => field.shortName === 'L')
    expect(localityField?.value).toBe('Playa Vista')

    const ouField = subject.find((field: { shortName: string, value: string }) => field.shortName === 'OU')
    expect(ouField?.value).toBe('Test Unit')
  })

  it('should handle invalid certificate data', () => {
    expect(() => isCertValidForDomain('invalid-cert-data', 'example.com')).toThrow()
    expect(() => parseCertDetails('invalid-cert-data')).toThrow()
    expect(() => isCertExpired('invalid-cert-data')).toThrow()
  })

  describe('file system operations', () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = join(tmpdir(), `tlsx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      mkdirSync(tempDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should list certificates in directory', () => {
      writeFileSync(join(tempDir, 'cert1.crt'), 'test')
      writeFileSync(join(tempDir, 'cert2.crt'), 'test')
      writeFileSync(join(tempDir, 'key.pem'), 'test')

      const certs = listCertsInDirectory(tempDir)
      const certFiles = certs.filter(cert => cert.startsWith(tempDir))
        .map(cert => cert.split('/').pop())

      expect(certFiles).toContain('cert1.crt')
      expect(certFiles).toContain('cert2.crt')
      expect(certFiles).not.toContain('key.pem')
    })
  })

  describe('certificate extensions', () => {
    it('should generate a certificate with key usage extensions', async () => {
      const options: CertificateOptions = {
        hostCertCN: 'localhost',
        domain: 'localhost',
        rootCA: {
          certificate: rootCA.certificate,
          privateKey: rootCA.privateKey,
        },
        keyUsage: {
          digitalSignature: true,
          keyEncipherment: true,
        },
        extKeyUsage: {
          serverAuth: true,
          clientAuth: true,
        },
      }
      const hostCert = await generateCertificate(options)
      const cert = getCertificateFromCertPemOrPath(hostCert.certificate)

      // Verify extended key usage OIDs (serverAuth=1.3.6.1.5.5.7.3.1, clientAuth=1.3.6.1.5.5.7.3.2)
      const keyUsage = cert.keyUsage || []
      expect(keyUsage).toContain('1.3.6.1.5.5.7.3.1')
      expect(keyUsage).toContain('1.3.6.1.5.5.7.3.2')
    })

    it('should generate a certificate with basic constraints', async () => {
      const options: CertificateOptions = {
        hostCertCN: 'localhost',
        domain: 'localhost',
        rootCA: {
          certificate: rootCA.certificate,
          privateKey: rootCA.privateKey,
        },
        basicConstraints: {
          cA: true,
          pathLenConstraint: 1,
        },
        keyUsage: {
          keyCertSign: true,
          cRLSign: true,
        },
      }
      const hostCert = await generateCertificate(options)
      const cert = getCertificateFromCertPemOrPath(hostCert.certificate)

      expect(cert.ca).toBe(true)
    })

    it('should generate a certificate with custom attributes', async () => {
      const options: CertificateOptions = {
        hostCertCN: 'localhost',
        domain: 'localhost',
        rootCA: {
          certificate: rootCA.certificate,
          privateKey: rootCA.privateKey,
        },
        certificateAttributes: [
          { shortName: 'OU', value: 'Test Unit' },
          { shortName: 'O', value: 'Test Corp' },
        ],
      }
      const hostCert = await generateCertificate(options)
      const details = parseCertDetails(hostCert.certificate)

      const subject = details.subject
      expect(subject.find((field: { shortName: string, value: string }) => field.shortName === 'OU')?.value).toBe('Test Unit')
      expect(subject.find((field: { shortName: string, value: string }) => field.shortName === 'O')?.value).toBe('Test Corp')
    })
  })
})
