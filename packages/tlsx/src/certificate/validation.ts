import type { CertDetails } from '../types'
import { pki } from 'node-forge'
import { readCertFromFile } from '../utils'
import fs from 'node:fs'
import { config } from '../config'
import { LOG_CATEGORIES } from '../constants'
import { debugLog } from '../utils'

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

export interface CertificateValidationResult {
  valid: boolean
  expired: boolean
  notYetValid: boolean
  issuerValid: boolean
  domains: string[]
  validFrom: Date
  validTo: Date
  issuer: string
  subject: string
  message?: string
}

/**
 * Validate a certificate
 * @param certificatePath Path to the certificate file
 * @param caCertificatePath Path to the CA certificate file
 * @param verbose Enable verbose logging
 * @returns Certificate validation result
 */
export function validateCertificate(
  certificatePath: string,
  caCertificatePath?: string,
  verbose?: boolean,
): CertificateValidationResult {
  debugLog(LOG_CATEGORIES.CERT, `Validating certificate: ${certificatePath}`, verbose)

  try {
    // Check if certificate exists
    if (!fs.existsSync(certificatePath)) {
      return {
        valid: false,
        expired: false,
        notYetValid: false,
        issuerValid: false,
        domains: [],
        validFrom: new Date(),
        validTo: new Date(),
        issuer: '',
        subject: '',
        message: `Certificate file not found: ${certificatePath}`,
      }
    }

    // Read certificate
    const certPem = fs.readFileSync(certificatePath, 'utf8')
    const cert = pki.certificateFromPem(certPem)

    // Check validity period
    const now = new Date()
    const notBefore = new Date(cert.validity.notBefore)
    const notAfter = new Date(cert.validity.notAfter)

    const expired = now > notAfter
    const notYetValid = now < notBefore

    // Get certificate subject and issuer
    const subject = cert.subject.getField('CN')?.value || 'Unknown'
    const issuer = cert.issuer.getField('CN')?.value || 'Unknown'

    // Extract domains from the certificate
    const domains: string[] = []

    // Add the CN as the first domain if it's a valid domain name (not an IP address)
    if (subject && !/^\d+\.\d+\.\d+\.\d+$/.test(subject)) {
      domains.push(subject)
    }

    // Get subject alt names
    const altNamesExt = cert.getExtension('subjectAltName')
    if (altNamesExt && 'altNames' in altNamesExt) {
      const altNames = altNamesExt.altNames as Array<{ type: number, value: string }>
      for (const altName of altNames) {
        if (altName.type === 2) { // DNS name
          domains.push(altName.value)
        }
      }
    }

    // Validate the issuer if CA certificate path is provided
    let issuerValid = false
    if (caCertificatePath) {
      if (fs.existsSync(caCertificatePath)) {
        try {
          const caCertPem = fs.readFileSync(caCertificatePath, 'utf8')
          const caCert = pki.certificateFromPem(caCertPem)

          // Check if the certificate was issued by the CA
          // Compare the issuer of the certificate with the subject of the CA certificate
          issuerValid = cert.isIssuer(caCert)
        }
        catch (error) {
          debugLog(LOG_CATEGORIES.CERT, `Error validating CA certificate: ${error}`, verbose)
        }
      }
      else {
        debugLog(LOG_CATEGORIES.CERT, `CA certificate file not found: ${caCertificatePath}`, verbose)
      }
    }

    const valid = !expired && !notYetValid && (caCertificatePath ? issuerValid : true)

    return {
      valid,
      expired,
      notYetValid,
      issuerValid,
      domains,
      validFrom: notBefore,
      validTo: notAfter,
      issuer,
      subject,
    }
  }
  catch (error) {
    debugLog(LOG_CATEGORIES.CERT, `Error validating certificate: ${error}`, verbose)

    return {
      valid: false,
      expired: false,
      notYetValid: false,
      issuerValid: false,
      domains: [],
      validFrom: new Date(),
      validTo: new Date(),
      issuer: '',
      subject: '',
      message: `Error validating certificate: ${error}`,
    }
  }
}