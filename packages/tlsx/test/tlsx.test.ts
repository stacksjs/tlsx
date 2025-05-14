import type { CAOptions, Certificate, CertificateOptions } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRootCA, findFoldersWithFile, generateCertificate, getCertificateFromCertPemOrPath, isCertExpired, isCertValidForDomain, listCertsInDirectory, parseCertDetails } from '../src'

describe('@stacksjs/tlsx', () => {
  let rootCA: Certificate

  beforeEach(async () => {
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
    const altNames = cert.getExtension('subjectAltName') as any

    // Type 7 is for IP addresses, Type 6 is for URIs in SubjectAltName extension
    const altNamesList = (altNames as any).altNames as Array<{ type: number, value: string }>
    expect(altNamesList.some(name => name.type === 7 && name.value === '127.0.0.1')).toBe(true)
    expect(altNamesList.some(name => name.type === 7 && name.value === '::1')).toBe(true)
    expect(altNamesList.some(name => name.type === 6 && name.value === 'https://localhost/app')).toBe(true)
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
      tempDir = join(tmpdir(), `tlsx-test-${Date.now()}`)
      mkdirSync(tempDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should find folders with specific files', () => {
      const testDir1 = join(tempDir, 'test1')
      const testDir2 = join(tempDir, 'test2')
      const testDir3 = join(tempDir, 'test3')

      mkdirSync(testDir1, { recursive: true })
      mkdirSync(testDir2, { recursive: true })
      mkdirSync(testDir3, { recursive: true })

      writeFileSync(join(testDir1, 'cert.pem'), 'test')
      writeFileSync(join(testDir3, 'cert.pem'), 'test')

      const foundDirs = findFoldersWithFile(tempDir, 'cert.pem')
      expect(foundDirs).toContain(testDir1)
      expect(foundDirs).toContain(testDir3)
      expect(foundDirs).not.toContain(testDir2)
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

      const keyUsage = cert.getExtension('keyUsage') as any
      expect((keyUsage as any).digitalSignature).toBe(true)
      expect((keyUsage as any).keyEncipherment).toBe(true)

      const extKeyUsage = cert.getExtension('extKeyUsage') as any
      expect((extKeyUsage as any).serverAuth).toBe(true)
      expect((extKeyUsage as any).clientAuth).toBe(true)
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
      }
      const hostCert = await generateCertificate(options)
      const cert = getCertificateFromCertPemOrPath(hostCert.certificate)

      const basicConstraints = cert.getExtension('basicConstraints') as any
      expect(basicConstraints?.cA).toBe(true)
      expect(basicConstraints?.pathLenConstraint).toBe(1)
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
