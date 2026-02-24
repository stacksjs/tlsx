/**
 * Native crypto implementation using Node.js built-in crypto module
 * This replaces node-forge with zero dependencies
 */
import crypto from 'node:crypto'

// ASN.1 tag types
const ASN1_TAG = {
  SEQUENCE: 0x30,
  SET: 0x31,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0C,
  PRINTABLE_STRING: 0x13,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  CONTEXT_0: 0xA0,
  CONTEXT_2: 0x82,
  CONTEXT_3: 0xA3,
} as const

// Common OIDs
const OID = {
  // Algorithms
  SHA256_WITH_RSA: '1.2.840.113549.1.1.11',
  RSA_ENCRYPTION: '1.2.840.113549.1.1.1',

  // Subject/Issuer attributes
  COMMON_NAME: '2.5.4.3',
  COUNTRY: '2.5.4.6',
  LOCALITY: '2.5.4.7',
  STATE: '2.5.4.8',
  ORGANIZATION: '2.5.4.10',
  ORGANIZATIONAL_UNIT: '2.5.4.11',

  // Extensions
  BASIC_CONSTRAINTS: '2.5.29.19',
  KEY_USAGE: '2.5.29.15',
  EXTENDED_KEY_USAGE: '2.5.29.37',
  SUBJECT_ALT_NAME: '2.5.29.17',
  SUBJECT_KEY_IDENTIFIER: '2.5.29.14',
  AUTHORITY_KEY_IDENTIFIER: '2.5.29.35',

  // Extended Key Usage values
  SERVER_AUTH: '1.3.6.1.5.5.7.3.1',
  CLIENT_AUTH: '1.3.6.1.5.5.7.3.2',
} as const

/**
 * Encode length in ASN.1 DER format
 */
function encodeLength(length: number): Buffer {
  if (length < 128) {
    return Buffer.from([length])
  }

  const bytes: number[] = []
  let temp = length
  while (temp > 0) {
    bytes.unshift(temp & 0xFF)
    temp >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

/**
 * Encode a complete ASN.1 TLV (Tag-Length-Value)
 */
function encodeTLV(tag: number, value: Buffer): Buffer {
  const length = encodeLength(value.length)
  return Buffer.concat([Buffer.from([tag]), length, value])
}

/**
 * Encode an OID string to DER
 */
function encodeOID(oid: string): Buffer {
  const parts = oid.split('.').map(Number)
  const bytes: number[] = []

  // First two components are encoded as 40*first + second
  bytes.push(40 * parts[0] + parts[1])

  // Remaining components use base-128 encoding
  for (let i = 2; i < parts.length; i++) {
    let value = parts[i]
    const encoded: number[] = []
    encoded.unshift(value & 0x7F)
    value >>= 7
    while (value > 0) {
      encoded.unshift((value & 0x7F) | 0x80)
      value >>= 7
    }
    bytes.push(...encoded)
  }

  return encodeTLV(ASN1_TAG.OID, Buffer.from(bytes))
}

/**
 * Encode an INTEGER (handling sign bit)
 */
function encodeInteger(value: Buffer | bigint | number): Buffer {
  let buf: Buffer
  if (typeof value === 'bigint') {
    const hex = value.toString(16).padStart(2, '0')
    buf = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex')
  } else if (typeof value === 'number') {
    if (value === 0) {
      buf = Buffer.from([0])
    } else {
      const hex = value.toString(16).padStart(2, '0')
      buf = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex')
    }
  } else {
    buf = value
  }

  // Add leading zero if high bit is set (to keep it positive)
  if (buf[0] & 0x80) {
    buf = Buffer.concat([Buffer.from([0]), buf])
  }

  return encodeTLV(ASN1_TAG.INTEGER, buf)
}

/**
 * Encode a BIT STRING
 */
function encodeBitString(value: Buffer, unusedBits = 0): Buffer {
  return encodeTLV(ASN1_TAG.BIT_STRING, Buffer.concat([Buffer.from([unusedBits]), value]))
}

/**
 * Encode an OCTET STRING
 */
function encodeOctetString(value: Buffer): Buffer {
  return encodeTLV(ASN1_TAG.OCTET_STRING, value)
}

/**
 * Encode a SEQUENCE
 */
function encodeSequence(...items: Buffer[]): Buffer {
  return encodeTLV(ASN1_TAG.SEQUENCE, Buffer.concat(items))
}

/**
 * Encode a SET
 */
function encodeSet(...items: Buffer[]): Buffer {
  return encodeTLV(ASN1_TAG.SET, Buffer.concat(items))
}

/**
 * Encode a PrintableString
 */
function encodePrintableString(str: string): Buffer {
  return encodeTLV(ASN1_TAG.PRINTABLE_STRING, Buffer.from(str, 'ascii'))
}

/**
 * Encode a UTF8String
 */
function encodeUTF8String(str: string): Buffer {
  return encodeTLV(ASN1_TAG.UTF8_STRING, Buffer.from(str, 'utf8'))
}

/**
 * Encode an IA5String
 */
function encodeIA5String(str: string): Buffer {
  return encodeTLV(ASN1_TAG.IA5_STRING, Buffer.from(str, 'ascii'))
}

/**
 * Encode a NULL
 */
function encodeNull(): Buffer {
  return Buffer.from([ASN1_TAG.NULL, 0])
}

/**
 * Encode a context-specific tag
 */
function encodeContext(tag: number, value: Buffer, constructed = true): Buffer {
  const tagByte = 0xA0 | tag | (constructed ? 0 : 0)
  const length = encodeLength(value.length)
  return Buffer.concat([Buffer.from([tagByte]), length, value])
}

/**
 * Encode a date as UTCTime or GeneralizedTime
 */
function encodeTime(date: Date): Buffer {
  const year = date.getUTCFullYear()
  // Use GeneralizedTime for years >= 2050, UTCTime otherwise
  if (year >= 2050) {
    const str = date.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z'
    return encodeTLV(ASN1_TAG.GENERALIZED_TIME, Buffer.from(str, 'ascii'))
  } else {
    const yy = (year % 100).toString().padStart(2, '0')
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const dd = date.getUTCDate().toString().padStart(2, '0')
    const hh = date.getUTCHours().toString().padStart(2, '0')
    const min = date.getUTCMinutes().toString().padStart(2, '0')
    const ss = date.getUTCSeconds().toString().padStart(2, '0')
    const str = `${yy}${mm}${dd}${hh}${min}${ss}Z`
    return encodeTLV(ASN1_TAG.UTC_TIME, Buffer.from(str, 'ascii'))
  }
}

/**
 * Encode validity period
 */
function encodeValidity(notBefore: Date, notAfter: Date): Buffer {
  return encodeSequence(encodeTime(notBefore), encodeTime(notAfter))
}

/**
 * Encode a Name (subject or issuer)
 */
function encodeName(attributes: Array<{ shortName: string, value: string }>): Buffer {
  const rdnSequences: Buffer[] = []

  for (const attr of attributes) {
    let oid: string
    switch (attr.shortName) {
      case 'CN': oid = OID.COMMON_NAME; break
      case 'C': oid = OID.COUNTRY; break
      case 'L': oid = OID.LOCALITY; break
      case 'ST': oid = OID.STATE; break
      case 'O': oid = OID.ORGANIZATION; break
      case 'OU': oid = OID.ORGANIZATIONAL_UNIT; break
      default: continue
    }

    const attrValue = attr.shortName === 'C'
      ? encodePrintableString(attr.value)
      : encodeUTF8String(attr.value)

    const attrTypeAndValue = encodeSequence(encodeOID(oid), attrValue)
    rdnSequences.push(encodeSet(attrTypeAndValue))
  }

  return encodeSequence(...rdnSequences)
}

/**
 * Encode algorithm identifier
 */
function encodeAlgorithmIdentifier(oid: string): Buffer {
  return encodeSequence(encodeOID(oid), encodeNull())
}

/**
 * Encode SubjectPublicKeyInfo from a public key
 */
function encodeSubjectPublicKeyInfo(publicKey: crypto.KeyObject): Buffer {
  // Export the public key in DER format
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  return spki
}

/**
 * Convert IP address string to bytes
 */
function ipToBytes(ip: string): Buffer {
  if (ip.includes(':')) {
    // IPv6
    let fullIp = ip
    if (ip.includes('::')) {
      const parts = ip.split('::')
      const left = parts[0] ? parts[0].split(':') : []
      const right = parts[1] ? parts[1].split(':') : []
      const missing = 8 - left.length - right.length
      const middle = Array.from({ length: missing }, () => '0')
      fullIp = [...left, ...middle, ...right].join(':')
    }
    const parts = fullIp.split(':')
    const bytes = Buffer.alloc(16)
    for (let i = 0; i < 8; i++) {
      const val = Number.parseInt(parts[i] || '0', 16)
      bytes.writeUInt16BE(val, i * 2)
    }
    return bytes
  } else {
    // IPv4
    const parts = ip.split('.').map(p => Number.parseInt(p, 10))
    return Buffer.from(parts)
  }
}

export interface SubjectAltNameEntry {
  type: number
  value?: string
  ip?: string
}

/**
 * Encode Subject Alternative Name extension
 */
function encodeSubjectAltName(altNames: SubjectAltNameEntry[]): Buffer {
  const names: Buffer[] = []

  for (const name of altNames) {
    if (name.type === 2 && name.value) {
      // DNS Name
      const length = encodeLength(name.value.length)
      names.push(Buffer.concat([Buffer.from([0x82]), length, Buffer.from(name.value, 'ascii')]))
    } else if (name.type === 7 && name.ip) {
      // IP Address
      const ipBytes = ipToBytes(name.ip)
      const length = encodeLength(ipBytes.length)
      names.push(Buffer.concat([Buffer.from([0x87]), length, ipBytes]))
    } else if (name.type === 6 && name.value) {
      // URI
      const length = encodeLength(name.value.length)
      names.push(Buffer.concat([Buffer.from([0x86]), length, Buffer.from(name.value, 'ascii')]))
    }
  }

  return encodeSequence(...names)
}

/**
 * Encode Basic Constraints extension
 */
function encodeBasicConstraints(isCA: boolean, pathLenConstraint?: number): Buffer {
  if (isCA) {
    if (pathLenConstraint !== undefined) {
      return encodeSequence(encodeTLV(0x01, Buffer.from([0xFF])), encodeInteger(pathLenConstraint))
    }
    return encodeSequence(encodeTLV(0x01, Buffer.from([0xFF]))) // BOOLEAN TRUE
  }
  return encodeSequence() // Empty sequence for non-CA
}

/**
 * Encode Key Usage extension
 */
function encodeKeyUsage(usage: {
  digitalSignature?: boolean
  keyEncipherment?: boolean
  keyCertSign?: boolean
  cRLSign?: boolean
}): Buffer {
  let bits = 0
  if (usage.digitalSignature) bits |= 0x80
  if (usage.keyEncipherment) bits |= 0x20
  if (usage.keyCertSign) bits |= 0x04
  if (usage.cRLSign) bits |= 0x02

  // Calculate unused bits (trailing zeros)
  let unusedBits = 0
  let temp = bits
  while (temp > 0 && (temp & 1) === 0) {
    unusedBits++
    temp >>= 1
  }
  if (bits === 0) unusedBits = 7

  return encodeBitString(Buffer.from([bits]), unusedBits)
}

/**
 * Encode Extended Key Usage extension
 */
function encodeExtendedKeyUsage(usage: { serverAuth?: boolean, clientAuth?: boolean }): Buffer {
  const oids: Buffer[] = []
  if (usage.serverAuth) oids.push(encodeOID(OID.SERVER_AUTH))
  if (usage.clientAuth) oids.push(encodeOID(OID.CLIENT_AUTH))
  return encodeSequence(...oids)
}

/**
 * Encode a certificate extension
 */
function encodeExtension(oid: string, critical: boolean, value: Buffer): Buffer {
  const parts = [encodeOID(oid)]
  if (critical) {
    parts.push(encodeTLV(0x01, Buffer.from([0xFF]))) // BOOLEAN TRUE
  }
  parts.push(encodeOctetString(value))
  return encodeSequence(...parts)
}

export interface CertificateParams {
  serialNumber: Buffer
  notBefore: Date
  notAfter: Date
  subject: Array<{ shortName: string, value: string }>
  issuer: Array<{ shortName: string, value: string }>
  publicKey: crypto.KeyObject
  extensions?: {
    basicConstraints?: { isCA: boolean, critical?: boolean, pathLenConstraint?: number }
    keyUsage?: { digitalSignature?: boolean, keyEncipherment?: boolean, keyCertSign?: boolean, cRLSign?: boolean, critical?: boolean }
    extendedKeyUsage?: { serverAuth?: boolean, clientAuth?: boolean }
    subjectAltName?: SubjectAltNameEntry[]
    subjectKeyIdentifier?: Buffer
  }
}

/**
 * Build the TBSCertificate structure
 */
function buildTBSCertificate(params: CertificateParams): Buffer {
  const parts: Buffer[] = []

  // Version (v3 = 2)
  parts.push(encodeContext(0, encodeInteger(2)))

  // Serial Number
  parts.push(encodeInteger(params.serialNumber))

  // Signature Algorithm
  parts.push(encodeAlgorithmIdentifier(OID.SHA256_WITH_RSA))

  // Issuer
  parts.push(encodeName(params.issuer))

  // Validity
  parts.push(encodeValidity(params.notBefore, params.notAfter))

  // Subject
  parts.push(encodeName(params.subject))

  // Subject Public Key Info
  parts.push(encodeSubjectPublicKeyInfo(params.publicKey))

  // Extensions (v3)
  if (params.extensions) {
    const extList: Buffer[] = []

    if (params.extensions.basicConstraints) {
      extList.push(encodeExtension(
        OID.BASIC_CONSTRAINTS,
        params.extensions.basicConstraints.critical ?? true,
        encodeBasicConstraints(params.extensions.basicConstraints.isCA, params.extensions.basicConstraints.pathLenConstraint),
      ))
    }

    if (params.extensions.keyUsage) {
      extList.push(encodeExtension(
        OID.KEY_USAGE,
        params.extensions.keyUsage.critical ?? true,
        encodeKeyUsage(params.extensions.keyUsage),
      ))
    }

    if (params.extensions.extendedKeyUsage) {
      extList.push(encodeExtension(
        OID.EXTENDED_KEY_USAGE,
        false,
        encodeExtendedKeyUsage(params.extensions.extendedKeyUsage),
      ))
    }

    if (params.extensions.subjectAltName?.length) {
      extList.push(encodeExtension(
        OID.SUBJECT_ALT_NAME,
        false,
        encodeSubjectAltName(params.extensions.subjectAltName),
      ))
    }

    if (params.extensions.subjectKeyIdentifier) {
      extList.push(encodeExtension(
        OID.SUBJECT_KEY_IDENTIFIER,
        false,
        encodeOctetString(params.extensions.subjectKeyIdentifier),
      ))
    }

    if (extList.length > 0) {
      parts.push(encodeContext(3, encodeSequence(...extList)))
    }
  }

  return encodeSequence(...parts)
}

/**
 * Sign a TBSCertificate and return the complete certificate
 */
function signCertificate(tbsCertificate: Buffer, privateKey: crypto.KeyObject): Buffer {
  const sign = crypto.createSign('SHA256')
  sign.update(tbsCertificate)
  const signature = sign.sign(privateKey)

  return encodeSequence(
    tbsCertificate,
    encodeAlgorithmIdentifier(OID.SHA256_WITH_RSA),
    encodeBitString(signature),
  )
}

/**
 * Convert DER to PEM format
 */
function derToPem(der: Buffer, type: 'CERTIFICATE' | 'PRIVATE KEY' | 'RSA PRIVATE KEY'): string {
  const base64 = der.toString('base64')
  const lines: string[] = []
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64))
  }
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`
}

/**
 * Generate a random serial number
 */
export function generateSerialNumber(): Buffer {
  return crypto.randomBytes(20)
}

/**
 * Generate an RSA key pair
 */
export function generateKeyPair(keySize = 2048): { privateKey: crypto.KeyObject, publicKey: crypto.KeyObject } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: keySize,
  })
  return { privateKey, publicKey }
}

/**
 * Calculate Subject Key Identifier (SHA-1 hash of public key)
 */
export function calculateSubjectKeyIdentifier(publicKey: crypto.KeyObject): Buffer {
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  // The actual public key bits are inside the SPKI structure
  // For simplicity, hash the whole SPKI
  return crypto.createHash('sha1').update(spki).digest()
}

export interface CreateCertificateOptions {
  serialNumber?: Buffer
  notBefore: Date
  notAfter: Date
  subject: Array<{ shortName: string, value: string }>
  issuer?: Array<{ shortName: string, value: string }>
  publicKey: crypto.KeyObject
  signingKey: crypto.KeyObject
  isCA?: boolean
  pathLenConstraint?: number
  keyUsage?: { digitalSignature?: boolean, keyEncipherment?: boolean, keyCertSign?: boolean, cRLSign?: boolean }
  extendedKeyUsage?: { serverAuth?: boolean, clientAuth?: boolean }
  subjectAltName?: SubjectAltNameEntry[]
}

/**
 * Create a certificate
 */
export function createCertificate(options: CreateCertificateOptions): { certificate: string, certificateDer: Buffer } {
  const params: CertificateParams = {
    serialNumber: options.serialNumber || generateSerialNumber(),
    notBefore: options.notBefore,
    notAfter: options.notAfter,
    subject: options.subject,
    issuer: options.issuer || options.subject,
    publicKey: options.publicKey,
    extensions: {
      basicConstraints: { isCA: options.isCA ?? false, critical: true, pathLenConstraint: options.pathLenConstraint },
      subjectKeyIdentifier: calculateSubjectKeyIdentifier(options.publicKey),
    },
  }

  if (options.keyUsage) {
    params.extensions!.keyUsage = { ...options.keyUsage, critical: true }
  }

  if (options.extendedKeyUsage) {
    params.extensions!.extendedKeyUsage = options.extendedKeyUsage
  }

  if (options.subjectAltName?.length) {
    params.extensions!.subjectAltName = options.subjectAltName
  }

  const tbsCert = buildTBSCertificate(params)
  const certDer = signCertificate(tbsCert, options.signingKey)
  const certPem = derToPem(certDer, 'CERTIFICATE')

  return { certificate: certPem, certificateDer: certDer }
}

/**
 * Export private key to PEM
 */
export function privateKeyToPem(privateKey: crypto.KeyObject): string {
  return privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
}

/**
 * Import private key from PEM
 */
export function privateKeyFromPem(pem: string): crypto.KeyObject {
  return crypto.createPrivateKey(pem)
}

/**
 * Import certificate from PEM and extract public key
 */
export function certificateFromPem(pem: string): { publicKey: crypto.KeyObject, subject: Array<{ shortName: string, value: string }> } {
  const cert = new crypto.X509Certificate(pem)
  const publicKey = cert.publicKey

  // Parse subject from certificate
  const subject: Array<{ shortName: string, value: string }> = []
  const subjectStr = cert.subject
  const parts = subjectStr.split('\n')
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=')
    const value = valueParts.join('=')
    if (key && value) {
      subject.push({ shortName: key.trim(), value: value.trim() })
    }
  }

  return { publicKey, subject }
}

/**
 * Make a hex string positive (ensure no leading 00 issues)
 */
export function makeSerialPositive(serial: Buffer): string {
  let hex = serial.toString('hex')
  // Ensure it doesn't start with 00 unless needed for sign bit
  while (hex.startsWith('00') && hex.length > 2) {
    hex = hex.slice(2)
  }
  return hex
}
