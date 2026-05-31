import type { KeyObject } from 'node:crypto'
import { sign } from 'node:crypto'
import { base64urlDecode } from './base64url'

/**
 * Minimal hand-rolled DER (ASN.1 Distinguished Encoding Rules) encoder, just
 * enough to build a PKCS#10 CertificationRequest for a P-256 key. We avoid an
 * X.509/ASN.1 dependency by emitting the handful of types a CSR needs.
 *
 * Every helper returns a complete TLV (tag + length + value) Buffer.
 */

// --- length encoding (DER definite form) ---

function encodeLength(len: number): Buffer {
  if (len < 0x80)
    return Buffer.from([len])

  // Long form: first byte is 0x80 | number-of-length-octets, then big-endian length.
  const bytes: number[] = []
  let n = len
  while (n > 0) {
    bytes.unshift(n & 0xFF)
    n >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

function tlv(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value])
}

// --- primitive types ---

/**
 * DER INTEGER. Accepts a non-negative JS number (used only for small values
 * like the CSR version `0`) or a Buffer of big-endian magnitude bytes.
 */
export function derInteger(value: number | Buffer): Buffer {
  let content: Buffer
  if (typeof value === 'number') {
    if (value === 0) {
      content = Buffer.from([0x00])
    }
    else {
      const bytes: number[] = []
      let n = value
      while (n > 0) {
        bytes.unshift(n & 0xFF)
        n >>= 8
      }
      // Prepend 0x00 if the high bit is set so it stays positive.
      if (bytes[0] & 0x80)
        bytes.unshift(0x00)
      content = Buffer.from(bytes)
    }
  }
  else {
    content = value.length === 0 ? Buffer.from([0x00]) : value
    if (content[0] & 0x80)
      content = Buffer.concat([Buffer.from([0x00]), content])
  }
  return tlv(0x02, content)
}

/** DER OBJECT IDENTIFIER from a dotted string, e.g. `1.2.840.10045.2.1`. */
export function derOid(oid: string): Buffer {
  const parts = oid.split('.').map(Number)
  if (parts.length < 2)
    throw new Error(`Invalid OID: ${oid}`)

  // First two arcs are packed into one byte as (40*a)+b.
  const bytes: number[] = [40 * parts[0] + parts[1]]
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i]
    const chunk: number[] = [v & 0x7F]
    v = Math.floor(v / 128)
    while (v > 0) {
      chunk.unshift((v & 0x7F) | 0x80)
      v = Math.floor(v / 128)
    }
    bytes.push(...chunk)
  }
  return tlv(0x06, Buffer.from(bytes))
}

/** DER NULL. */
export function derNull(): Buffer {
  return Buffer.from([0x05, 0x00])
}

/** DER SEQUENCE wrapping the concatenation of its elements. */
export function derSequence(...elements: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(elements))
}

/** DER SET wrapping the concatenation of its elements. */
export function derSet(...elements: Buffer[]): Buffer {
  return tlv(0x31, Buffer.concat(elements))
}

/** DER BIT STRING with zero unused bits. */
export function derBitString(value: Buffer): Buffer {
  return tlv(0x03, Buffer.concat([Buffer.from([0x00]), value]))
}

/** DER OCTET STRING. */
export function derOctetString(value: Buffer): Buffer {
  return tlv(0x04, value)
}

/** DER PrintableString. */
export function derPrintableString(value: string): Buffer {
  return tlv(0x13, Buffer.from(value, 'ascii'))
}

/** DER UTF8String. */
export function derUtf8String(value: string): Buffer {
  return tlv(0x0C, Buffer.from(value, 'utf8'))
}

/**
 * Context-tagged element. `constructed` selects the constructed bit (0x20);
 * the class is context-specific (0x80).
 */
export function derContext(tagNumber: number, value: Buffer, constructed: boolean): Buffer {
  const tag = 0x80 | (constructed ? 0x20 : 0x00) | tagNumber
  return tlv(tag, value)
}

// --- OIDs ---

const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1'
const OID_PRIME256V1 = '1.2.840.10045.3.1.7'
const OID_ECDSA_WITH_SHA256 = '1.2.840.10045.4.3.2'
const OID_COMMON_NAME = '2.5.4.3'
const OID_EXTENSION_REQUEST = '1.2.840.113549.1.9.14'
const OID_SUBJECT_ALT_NAME = '2.5.29.17'

/**
 * Returns the uncompressed EC point `0x04 || x || y` (65 bytes for P-256) from
 * a P-256 public key, derived from its JWK `x`/`y` coordinates.
 */
function uncompressedPoint(publicKey: KeyObject): Buffer {
  const jwk = publicKey.export({ format: 'jwk' }) as { x?: string, y?: string }
  if (!jwk.x || !jwk.y)
    throw new Error('Public key JWK is missing x/y coordinates')

  const x = base64urlDecode(jwk.x)
  const y = base64urlDecode(jwk.y)
  if (x.length !== 32 || y.length !== 32)
    throw new Error(`Expected 32-byte P-256 coordinates, got x=${x.length} y=${y.length}`)

  return Buffer.concat([Buffer.from([0x04]), x, y])
}

/**
 * Builds a PKCS#10 CertificationRequest (RFC 2986) in DER for a P-256 key,
 * with the given DNS names (including wildcards like `*.example.com`) as
 * Subject Alternative Names, signed with ECDSA-with-SHA256.
 *
 * Structure:
 * ```
 * CertificationRequest ::= SEQUENCE {
 *   certificationRequestInfo CertificationRequestInfo,
 *   signatureAlgorithm       AlgorithmIdentifier,   -- ecdsa-with-SHA256
 *   signature                BIT STRING }           -- DER ECDSA over the info
 * ```
 * @param params - The CSR parameters.
 * @param params.domains - DNS names; `domains[0]` becomes the subject CN.
 * @param params.publicKey - The P-256 public key.
 * @param params.privateKey - The matching P-256 private key (signs the request).
 * @returns The DER-encoded CSR bytes.
 */
export function buildCsr(params: {
  domains: string[]
  publicKey: KeyObject
  privateKey: KeyObject
}): Buffer {
  const { domains, publicKey, privateKey } = params
  if (domains.length === 0)
    throw new Error('At least one domain is required to build a CSR')

  // subject: SEQUENCE OF RDN; one RDN = SET OF AttributeTypeAndValue (CN).
  const subject = derSequence(
    derSet(
      derSequence(derOid(OID_COMMON_NAME), derUtf8String(domains[0])),
    ),
  )

  // SubjectPublicKeyInfo for an EC P-256 key.
  const spki = derSequence(
    derSequence(derOid(OID_EC_PUBLIC_KEY), derOid(OID_PRIME256V1)),
    derBitString(uncompressedPoint(publicKey)),
  )

  // subjectAltName extension value: SEQUENCE OF GeneralName, each dNSName [2].
  const generalNames = domains.map(d => derContext(2, Buffer.from(d, 'ascii'), false))
  const sanExtnValue = derSequence(...generalNames)
  const sanExtension = derSequence(
    derOid(OID_SUBJECT_ALT_NAME),
    derOctetString(sanExtnValue),
  )
  const extensions = derSequence(sanExtension)

  // attributes [0] IMPLICIT SET OF Attribute; one extensionRequest attribute.
  const extensionRequestAttr = derSequence(
    derOid(OID_EXTENSION_REQUEST),
    derSet(extensions),
  )
  const attributes = derContext(0, extensionRequestAttr, true)

  const certificationRequestInfo = derSequence(
    derInteger(0), // version v1 (0)
    subject,
    spki,
    attributes,
  )

  // signature = DER ECDSA over the DER-encoded CertificationRequestInfo.
  // NOTE: default dsaEncoding ('der'), NOT ieee-p1363 — X.509/PKCS#10 want DER.
  const signature = sign('sha256', certificationRequestInfo, privateKey)

  const signatureAlgorithm = derSequence(derOid(OID_ECDSA_WITH_SHA256))

  return derSequence(
    certificationRequestInfo,
    signatureAlgorithm,
    derBitString(signature),
  )
}

/**
 * Builds a CSR and returns it base64url-encoded, the form ACME's `finalize`
 * endpoint expects in its `csr` member.
 * @param params - The same parameters as {@link buildCsr}.
 * @returns The base64url-encoded DER CSR.
 */
export function buildCsrBase64url(params: {
  domains: string[]
  publicKey: KeyObject
  privateKey: KeyObject
}): string {
  return buildCsr(params).toString('base64url')
}
