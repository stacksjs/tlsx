import type { CertOption } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { createRootCA, generateCert, isCertExpired, isCertValidForDomain, parseCertDetails } from '../src'

describe('@stacksjs/tlsx', () => {
  it('should create a Root CA certificate', async () => {
    const rootCA = await createRootCA()
    expect(rootCA).toHaveProperty('certificate')
    expect(rootCA).toHaveProperty('privateKey')
    expect(rootCA).toHaveProperty('notBefore')
    expect(rootCA).toHaveProperty('notAfter')
  })

  it('should generate a host certificate', async () => {
    const rootCA = await createRootCA()
    const options: CertOption = {
      hostCertCN: 'localhost',
      domain: 'localhost',
      rootCAObject: {
        certificate: rootCA.certificate,
        privateKey: rootCA.privateKey,
      },
    }
    const hostCert = await generateCert(options)
    expect(hostCert).toHaveProperty('certificate')
    expect(hostCert).toHaveProperty('privateKey')
    expect(hostCert).toHaveProperty('notBefore')
    expect(hostCert).toHaveProperty('notAfter')
  })

  it('should validate a certificate for a domain', async () => {
    const rootCA = await createRootCA()
    const options: CertOption = {
      hostCertCN: 'localhost',
      domain: 'localhost',
      rootCAObject: {
        certificate: rootCA.certificate,
        privateKey: rootCA.privateKey,
      },
    }
    const hostCert = await generateCert(options)
    const isValid = isCertValidForDomain(hostCert.certificate, 'localhost')
    expect(isValid).toBe(true)
  })

  it('should parse certificate details', async () => {
    const rootCA = await createRootCA()
    const certDetails = parseCertDetails(rootCA.certificate)
    expect(certDetails).toHaveProperty('subject')
    expect(certDetails).toHaveProperty('issuer')
    expect(certDetails).toHaveProperty('validFrom')
    expect(certDetails).toHaveProperty('validTo')
    expect(certDetails).toHaveProperty('serialNumber')
  })

  it('should check if a certificate is expired', async () => {
    const rootCA = await createRootCA()
    const isExpired = isCertExpired(rootCA.certificate)
    expect(isExpired).toBe(false)
  })
})
