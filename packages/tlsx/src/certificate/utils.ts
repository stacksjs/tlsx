import type { CertificateExtension, CertificateOptions, RandomSerialNumber, SubjectAltName } from '../types'
import forge from 'node-forge'
import { CERT_CONSTANTS, LOG_CATEGORIES } from '../constants'
import { debugLog, makeNumberPositive } from '../utils'

/**
 * Generates Subject Alternative Names for the certificate
 * @param options Certificate generation options
 * @returns Array of SubjectAltName objects
 */
export function generateSubjectAltNames(options: CertificateOptions): SubjectAltName[] {
  const altNames: SubjectAltName[] = []

  // Add all domains to SAN
  const domains = new Set<string>()

  // Add primary domain if explicitly set
  if (options.domain) {
    domains.add(options.domain)
  }

  // Add all domains from the domains array
  if (options.domains?.length) {
    options.domains.forEach(domain => domains.add(domain))
  }

  // Convert domains to SAN entries
  for (const domain of domains) {
    altNames.push({ type: 2, value: domain })
  }

  // Add IP addresses if specified
  if (options.altNameIPs?.length) {
    for (const ip of options.altNameIPs) {
      altNames.push({ type: 7, value: ip })
    }
  }

  // Add URIs if specified
  if (options.altNameURIs?.length) {
    for (const uri of options.altNameURIs) {
      altNames.push({ type: 6, value: uri })
    }
  }

  // Add any additional subject alt names
  if (options.subjectAltNames?.length) {
    altNames.push(...options.subjectAltNames)
  }

  debugLog(LOG_CATEGORIES.CERT, `Generated ${altNames.length} Subject Alternative Names`, options.verbose)
  return altNames
}

/**
 * Generate a random serial number for the Certificate
 * @returns The serial number for the Certificate
 */
export function generateRandomSerial(verbose?: boolean): RandomSerialNumber {
  debugLog(LOG_CATEGORIES.CERT, 'Generating random serial number', verbose)
  const serialNumber = makeNumberPositive(forge.util.bytesToHex(forge.random.getBytesSync(20)))
  debugLog(LOG_CATEGORIES.CERT, `Generated serial number: ${serialNumber}`, verbose)
  return serialNumber
}

/**
 * Calculate validity dates for a certificate
 */
export function calculateValidityDates(options: {
  validityDays?: number
  validityYears?: number
  notBeforeDays?: number
  verbose?: boolean
}): { notBefore: Date, notAfter: Date } {
  const notBeforeDays = options.notBeforeDays ?? CERT_CONSTANTS.DEFAULT_NOT_BEFORE_DAYS
  const validityDays = options.validityDays ?? (options.validityYears ? options.validityYears * 365 : CERT_CONSTANTS.DEFAULT_VALIDITY_DAYS)

  debugLog(LOG_CATEGORIES.CERT, 'Calculating certificate validity dates', options.verbose)

  const notBefore = new Date(Date.now() - 60 * 60 * 24 * notBeforeDays * 1000)
  const notAfter = new Date(notBefore.getTime() + validityDays * 24 * 60 * 60 * 1000)

  // Normalize dates to midnight UTC
  notBefore.setUTCHours(0, 0, 0, 0)
  notAfter.setUTCHours(23, 59, 59, 999)

  debugLog(LOG_CATEGORIES.CERT, `Validity period: ${notBefore.toISOString()} to ${notAfter.toISOString()}`, options.verbose)

  return { notBefore, notAfter }
}

/**
 * Generates certificate extensions including subject alt names
 * @param options Certificate generation options
 * @returns Array of certificate extensions
 */
export function generateCertificateExtensions(options: CertificateOptions): CertificateExtension[] {
  const extensions: CertificateExtension[] = []

  // Add basic constraints
  extensions.push({
    name: 'basicConstraints',
    cA: options.isCA ?? false,
    critical: true,
    ...(options.basicConstraints || {}),
  })

  // Add subject alt names
  const altNames = generateSubjectAltNames(options)
  if (altNames.length > 0) {
    extensions.push({
      name: 'subjectAltName',
      altNames,
    })
  }

  // Add key usage if specified
  if (options.keyUsage) {
    extensions.push({
      name: 'keyUsage',
      critical: true,
      ...options.keyUsage,
    })
  }

  // Add extended key usage if specified
  if (options.extKeyUsage) {
    extensions.push({
      name: 'extKeyUsage',
      ...options.extKeyUsage,
    })
  }

  return extensions
}

export { forge }
