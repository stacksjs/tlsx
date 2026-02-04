import type { CAOptions, Certificate, CertificateOptions } from '../types'
import { config } from '../config'
import { CERT_CONSTANTS } from '../constants'
import { debugLog, getPrimaryDomain } from '../utils'
import {
  certificateFromPem,
  createCertificate,
  generateKeyPair,
  generateSerialNumber,
  makeSerialPositive,
  privateKeyFromPem,
  privateKeyToPem,
} from './native-crypto'
import { calculateValidityDates, generateSubjectAltNames } from './utils'

/**
 * Creates a new Root CA certificate
 * @param options CA Certificate generation options
 * @returns Generated CA Certificate
 */
export async function createRootCA(options: CAOptions = {}): Promise<Certificate> {
  debugLog('ca', 'Creating new Root CA Certificate', options.verbose)

  const keySize = options.keySize || CERT_CONSTANTS.DEFAULT_KEY_SIZE
  debugLog('ca', `Generating ${keySize}-bit RSA key pair`, options.verbose)
  const { privateKey, publicKey } = generateKeyPair(keySize)

  const attributes = [
    { shortName: 'C', value: options.countryName || config.countryName },
    { shortName: 'ST', value: options.stateName || config.stateName },
    { shortName: 'L', value: options.localityName || config.localityName },
    { shortName: 'O', value: options.organization || 'Local Development CA' },
    { shortName: 'OU', value: options.organizationalUnit || 'Certificate Authority' },
    { shortName: 'CN', value: options.commonName || 'Local Development Root CA' },
  ]

  const { notBefore, notAfter } = calculateValidityDates({
    validityYears: options.validityYears || CERT_CONSTANTS.DEFAULT_CA_VALIDITY_YEARS,
    verbose: options.verbose,
  })

  const { certificate } = createCertificate({
    serialNumber: generateSerialNumber(),
    notBefore,
    notAfter,
    subject: attributes,
    publicKey,
    signingKey: privateKey,
    isCA: true,
    keyUsage: {
      keyCertSign: true,
      cRLSign: true,
    },
  })

  return {
    certificate,
    privateKey: privateKeyToPem(privateKey),
    notBefore,
    notAfter,
  }
}

/**
 * Generates a certificate for one or multiple domains
 * @param options Certificate generation options
 * @returns Generated certificate
 */
export async function generateCertificate(options: CertificateOptions): Promise<Certificate> {
  debugLog('ca', 'Generating new certificate', options.verbose)
  debugLog('ca', `Options: ${JSON.stringify(options)}`, options.verbose)

  // Validate that at least one domain is specified
  if (!options.domain && !options.domains?.length) {
    throw new Error('Either domain or domains must be specified')
  }

  if (!options.rootCA?.certificate || !options.rootCA?.privateKey) {
    throw new Error('Root CA certificate and private key are required')
  }

  const { subject: caSubject } = certificateFromPem(options.rootCA.certificate)
  const caKey = privateKeyFromPem(options.rootCA.privateKey)

  debugLog('ca', `Generating ${CERT_CONSTANTS.DEFAULT_KEY_SIZE}-bit RSA key pair for host certificate`, options.verbose)
  const keySize = CERT_CONSTANTS.DEFAULT_KEY_SIZE
  const { privateKey, publicKey } = generateKeyPair(keySize)

  // Use the primary domain for the CN if no specific commonName is provided
  const commonName = options.commonName || getPrimaryDomain(options)

  const attributes = options.certificateAttributes || [
    { shortName: 'C', value: options.countryName || config.countryName },
    { shortName: 'ST', value: options.stateName || config.stateName },
    { shortName: 'L', value: options.localityName || config.localityName },
    { shortName: 'O', value: options.organizationName || config.organizationName },
    { shortName: 'CN', value: commonName },
  ]

  const { notBefore, notAfter } = calculateValidityDates({
    validityDays: options.validityDays || CERT_CONSTANTS.DEFAULT_VALIDITY_DAYS,
    verbose: options.verbose,
  })

  // Generate SAN entries
  const altNames = generateSubjectAltNames(options)

  // Build key usage from options
  const keyUsage = options.keyUsage || {
    digitalSignature: true,
    keyEncipherment: true,
  }

  // Build extended key usage from options
  const extendedKeyUsage = options.extKeyUsage || {
    serverAuth: true,
  }

  const { certificate } = createCertificate({
    serialNumber: generateSerialNumber(),
    notBefore,
    notAfter,
    subject: attributes,
    issuer: caSubject,
    publicKey,
    signingKey: caKey,
    isCA: false,
    keyUsage,
    extendedKeyUsage,
    subjectAltName: altNames,
  })

  return {
    certificate,
    privateKey: privateKeyToPem(privateKey),
    notBefore,
    notAfter,
  }
}
