import type { CertDetails } from '../types'
import { pki } from 'node-forge'
import { readCertFromFile } from '../utils'

/**
 * Checks if a certificate is valid for a given domain.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @param domain - The domain to check.
 * @returns {boolean} - True if the certificate is valid for the domain, false otherwise.
 */
export function isCertValidForDomain(certPemOrPath: string, domain: string): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const altNames = cert.getExtension('subjectAltName')

  if (altNames) {
    // @ts-expect-error - altNames is not yet typed at lib level
    for (const altName of altNames.altNames) {
      if (altName.value === domain) {
        return true
      }
    }
  }

  return cert.subject.getField('CN').value === domain
}

/**
 * Parses and extracts details from a certificate.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns {CertDetails} - An object containing certificate details.
 */
export function parseCertDetails(certPemOrPath: string): CertDetails {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)

  return {
    subject: cert.subject.attributes,
    issuer: cert.issuer.attributes,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
    serialNumber: cert.serialNumber,
  }
}

/**
 * Checks if a certificate is expired.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns {boolean} - True if the certificate is expired, false otherwise.
 */
export function isCertExpired(certPemOrPath: string): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const now = new Date()

  return now > cert.validity.notAfter
}

/**
 * Checks if a certificate will expire soon.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @param daysThreshold - Number of days to consider as "soon". Default is 30.
 * @returns {boolean} - True if the certificate will expire within the threshold, false otherwise.
 */
export function willCertExpireSoon(certPemOrPath: string, daysThreshold = 30): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const now = new Date()
  const expiryDate = new Date(cert.validity.notAfter)

  // Calculate the difference in days
  const diffTime = expiryDate.getTime() - now.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)

  return diffDays <= daysThreshold
}

/**
 * Gets a certificate from a PEM string or a path to a certificate file.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns {pki.Certificate} - The certificate object.
 */
export function getCertificateFromCertPemOrPath(certPemOrPath: string): pki.Certificate {
  let certPem: string

  if (certPemOrPath.startsWith('-----BEGIN CERTIFICATE-----')) {
    // If the input is a PEM string
    certPem = certPemOrPath
  }
  else {
    // If the input is a path to the certificate file
    certPem = readCertFromFile(certPemOrPath)
  }

  return pki.certificateFromPem(certPem)
}