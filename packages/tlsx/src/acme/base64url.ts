/**
 * Base64url (RFC 4648 §5) encoding/decoding helpers, without padding.
 *
 * ACME (RFC 8555) and JWS (RFC 7515) require unpadded base64url throughout —
 * for JWS protected headers, payloads, signatures, thumbprints, and the
 * dns-01 challenge digest. Node's `Buffer` supports the `base64url` encoding
 * natively, so these are thin wrappers that also accept strings.
 */

/**
 * Encodes a Buffer or string as unpadded base64url.
 * @param input - The data to encode (a Buffer, or a UTF-8 string).
 * @returns The base64url-encoded string with no `=` padding.
 */
export function base64urlEncode(input: Buffer | Uint8Array | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  // Buffer's `base64url` encoder already omits padding.
  return buf.toString('base64url')
}

/**
 * Decodes an unpadded (or padded) base64url string into a Buffer.
 * @param input - The base64url-encoded string.
 * @returns The decoded bytes.
 */
export function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

/**
 * Decodes an unpadded base64url string into a UTF-8 string.
 * @param input - The base64url-encoded string.
 * @returns The decoded UTF-8 string.
 */
export function base64urlDecodeToString(input: string): string {
  return base64urlDecode(input).toString('utf8')
}
