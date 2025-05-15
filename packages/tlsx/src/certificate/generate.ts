import type { CAOptions, Certificate, CertificateOptions } from '../types'
import forge, { pki } from 'node-forge'
import { config } from '../config'
import { CERT_CONSTANTS } from '../constants'
import { debugLog, getPrimaryDomain } from '../utils'
import { calculateValidityDates, generateCertificateExtensions, generateRandomSerial } from './utils'

/**
 * Creates a new Root CA certificate
 * @param options CA Certificate generation options
 * @returns Generated CA Certificate
 */
export async function createRootCA(options: CAOptions = {}): Promise<Certificate> {
  debugLog('ca', 'Creating new Root CA Certificate', options.verbose)

  const keySize = options.keySize || CERT_CONSTANTS.DEFAULT_KEY_SIZE
  debugLog('ca', `Generating ${keySize}-bit RSA key pair`, options.verbose)
  const { privateKey, publicKey } = pki.rsa.generateKeyPair(keySize)

  const attributes = [
    { shortName: 'C', value: options.countryName || config.countryName },
    { shortName: 'ST', value: options.stateName || config.stateName },
    { shortName: 'L', value: options.localityName || config.localityName },
    { shortName: 'O', value: options.organization || 'Local Development CA' },
    { shortName: 'OU', value: options.organizationalUnit || 'Certificate Authority' },
    { shortName: 'CN', value: options.commonName || 'Local Development Root CA' },
    ...(options.extraAttributes || []),
  ]

  const { notBefore, notAfter } = calculateValidityDates({
    validityYears: options.validityYears || CERT_CONSTANTS.DEFAULT_CA_VALIDITY_YEARS,
    verbose: options.verbose,
  })

  const caCert = pki.createCertificate()
  caCert.publicKey = publicKey
  caCert.serialNumber = generateRandomSerial(options.verbose)
  caCert.validity.notBefore = notBefore
  caCert.validity.notAfter = notAfter
  caCert.setSubject(attributes)
  caCert.setIssuer(attributes)

  caCert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true,
      critical: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      cRLSign: true,
      critical: true,
    },
    {
      name: 'subjectKeyIdentifier',
    },
  ])

  caCert.sign(privateKey, forge.md.sha256.create())

  return {
    certificate: pki.certificateToPem(caCert),
    privateKey: pki.privateKeyToPem(privateKey),
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

  const caCert = pki.certificateFromPem(options.rootCA.certificate)
  const caKey = pki.privateKeyFromPem(options.rootCA.privateKey)

  debugLog('ca', `Generating ${CERT_CONSTANTS.DEFAULT_KEY_SIZE}-bit RSA key pair for host certificate`, options.verbose)
  const keySize = CERT_CONSTANTS.DEFAULT_KEY_SIZE
  const { privateKey, publicKey } = pki.rsa.generateKeyPair(keySize)

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

  // Generate certificate
  const cert = pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = generateRandomSerial(options.verbose)
  cert.validity.notBefore = notBefore
  cert.validity.notAfter = notAfter
  cert.setSubject(attributes)
  cert.setIssuer(caCert.subject.attributes)

  // Set extensions with proper typing
  cert.setExtensions(generateCertificateExtensions(options))
  cert.sign(caKey, forge.md.sha256.create())

  return {
    certificate: pki.certificateToPem(cert),
    privateKey: pki.privateKeyToPem(privateKey),
    notBefore,
    notAfter,
  }
}
