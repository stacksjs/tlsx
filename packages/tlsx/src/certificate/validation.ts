import type { CertDetails } from '../types'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { LOG_CATEGORIES } from '../constants'
import { debugLog, readCertFromFile } from '../utils'

/**
 * Gets a certificate from a PEM string or a path to a certificate file.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns The X509Certificate object.
 */
export function getCertificateFromCertPemOrPath(certPemOrPath: string): crypto.X509Certificate {
  let certPem: string

  if (certPemOrPath.startsWith('-----BEGIN CERTIFICATE-----')) {
    certPem = certPemOrPath
  } else {
    certPem = readCertFromFile(certPemOrPath)
  }

  return new crypto.X509Certificate(certPem)
}

/**
 * Parse the subject or issuer string from X509Certificate
 */
function parseDistinguishedName(dn: string): Array<{ shortName: string, value: string }> {
  const result: Array<{ shortName: string, value: string }> = []
  const parts = dn.split('\n')
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=')
    const value = valueParts.join('=')
    if (key && value) {
      result.push({ shortName: key.trim(), value: value.trim() })
    }
  }
  return result
}

/**
 * Get the Common Name from a distinguished name string
 */
function getCommonName(dn: string): string {
  const parts = parseDistinguishedName(dn)
  const cn = parts.find(p => p.shortName === 'CN')
  return cn?.value || ''
}

/**
 * Extract domains from a certificate's Subject Alternative Names
 */
function extractDomainsFromCert(cert: crypto.X509Certificate): string[] {
  const domains: string[] = []

  // Add CN if it's a valid domain name
  const cn = getCommonName(cert.subject)
  if (cn && !/^\d+\.\d+\.\d+\.\d+$/.test(cn)) {
    domains.push(cn)
  }

  // Parse subjectAltName - format is like "DNS:example.com, DNS:*.example.com, IP Address:127.0.0.1"
  const san = cert.subjectAltName
  if (san) {
    const entries = san.split(', ')
    for (const entry of entries) {
      if (entry.startsWith('DNS:')) {
        domains.push(entry.slice(4))
      }
    }
  }

  return [...new Set(domains)] // Remove duplicates
}

/**
 * Checks if a certificate is valid for a given domain.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @param domain - The domain to check.
 * @returns True if the certificate is valid for the domain, false otherwise.
 */
export function isCertValidForDomain(certPemOrPath: string, domain: string): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const domains = extractDomainsFromCert(cert)

  for (const certDomain of domains) {
    if (certDomain === domain) {
      return true
    }
    // Handle wildcard domains
    if (certDomain.startsWith('*.')) {
      const wildcardBase = certDomain.slice(2)
      if (domain.endsWith(wildcardBase) && domain.indexOf('.') === domain.lastIndexOf('.')) {
        return true
      }
    }
  }

  return false
}

/**
 * Parses and extracts details from a certificate.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns An object containing certificate details.
 */
export function parseCertDetails(certPemOrPath: string): CertDetails {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)

  return {
    subject: parseDistinguishedName(cert.subject),
    issuer: parseDistinguishedName(cert.issuer),
    validFrom: new Date(cert.validFrom),
    validTo: new Date(cert.validTo),
    serialNumber: cert.serialNumber,
  }
}

/**
 * Checks if a certificate is expired.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @returns True if the certificate is expired, false otherwise.
 */
export function isCertExpired(certPemOrPath: string): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const now = new Date()
  return now > new Date(cert.validTo)
}

/**
 * Checks if a certificate will expire soon.
 * @param certPemOrPath - The certificate in PEM format or the path to the certificate file.
 * @param daysThreshold - Number of days to consider as "soon". Default is 30.
 * @returns True if the certificate will expire within the threshold, false otherwise.
 */
export function willCertExpireSoon(certPemOrPath: string, daysThreshold = 30): boolean {
  const cert = getCertificateFromCertPemOrPath(certPemOrPath)
  const now = new Date()
  const expiryDate = new Date(cert.validTo)

  const diffTime = expiryDate.getTime() - now.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)

  return diffDays <= daysThreshold
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

    const certPem = fs.readFileSync(certificatePath, 'utf8')
    const cert = new crypto.X509Certificate(certPem)

    const now = new Date()
    const notBefore = new Date(cert.validFrom)
    const notAfter = new Date(cert.validTo)

    const expired = now > notAfter
    const notYetValid = now < notBefore

    const subject = getCommonName(cert.subject)
    const issuer = getCommonName(cert.issuer)
    const domains = extractDomainsFromCert(cert)

    // Validate the issuer if CA certificate path is provided
    let issuerValid = false
    if (caCertificatePath) {
      if (fs.existsSync(caCertificatePath)) {
        try {
          const caCertPem = fs.readFileSync(caCertificatePath, 'utf8')
          const caCert = new crypto.X509Certificate(caCertPem)

          // Verify the certificate was signed by the CA
          issuerValid = cert.verify(caCert.publicKey)
        } catch (error) {
          debugLog(LOG_CATEGORIES.CERT, `Error validating CA certificate: ${error}`, verbose)
        }
      } else {
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
  } catch (error) {
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

/**
 * Checks if a certificate is compatible with modern browsers
 * @param certificatePath Path to the certificate file
 * @param verbose Enable verbose logging
 * @returns Browser compatibility validation result with specific issues, if any
 */
export function validateBrowserCompatibility(
  certificatePath: string,
  verbose?: boolean,
): { compatible: boolean, issues: string[] } {
  debugLog(LOG_CATEGORIES.CERT, `Validating browser compatibility: ${certificatePath}`, verbose)

  try {
    if (!fs.existsSync(certificatePath)) {
      return {
        compatible: false,
        issues: [`Certificate file not found: ${certificatePath}`],
      }
    }

    const certPem = fs.readFileSync(certificatePath, 'utf8')
    const cert = new crypto.X509Certificate(certPem)

    const issues: string[] = []

    // Check for localhost SAN
    let hasLocalhost = false
    let hasWildcard = false

    const cn = getCommonName(cert.subject)
    if (cn === 'localhost') {
      hasLocalhost = true
    }

    // Check SANs
    const san = cert.subjectAltName
    if (san) {
      const entries = san.split(', ')
      for (const entry of entries) {
        if (entry === 'DNS:localhost') {
          hasLocalhost = true
        }
        if (entry.includes('*')) {
          hasWildcard = true
        }
      }
    }

    if (!hasLocalhost) {
      issues.push('Certificate does not include "localhost" in Subject Alternative Names, which may cause issues with some browsers.')
    }

    if (hasWildcard) {
      issues.push('Certificate contains wildcard domains, which may not be fully supported in all browsers for localhost development.')
    }

    // Check key usage for serverAuth
    const keyUsage = cert.keyUsage
    const extKeyUsage = cert.extKeyUsage || ''
    const hasServerAuth = extKeyUsage.includes('TLS Web Server Authentication') || extKeyUsage.includes('1.3.6.1.5.5.7.3.1')

    if (!hasServerAuth) {
      issues.push('Certificate lacks Extended Key Usage for serverAuth, which is required by modern browsers.')
    }

    // Check if validity period is longer than 398 days
    const notBefore = new Date(cert.validFrom)
    const notAfter = new Date(cert.validTo)

    const validityDays = (notAfter.getTime() - notBefore.getTime()) / (1000 * 60 * 60 * 24)
    if (validityDays > 398) {
      issues.push(`Certificate validity period is ${Math.floor(validityDays)} days, which exceeds the 398-day maximum supported by modern browsers.`)
    }

    return {
      compatible: issues.length === 0,
      issues,
    }
  } catch (error) {
    debugLog(LOG_CATEGORIES.CERT, `Error validating browser compatibility: ${error}`, verbose)

    return {
      compatible: false,
      issues: [`Error validating browser compatibility: ${error}`],
    }
  }
}
