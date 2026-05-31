import type { KeyObject } from 'node:crypto'
import { createHash, sign } from 'node:crypto'
import { base64urlEncode } from './base64url'

/**
 * A JSON Web Key for an EC P-256 public key, as used by ACME.
 *
 * The member order here (`crv`, `kty`, `x`, `y`) is significant: RFC 7638
 * thumbprints require the canonical members to be serialized in lexicographic
 * order, and these four happen to already be sorted, so we preserve it.
 */
export interface EcJwk {
  crv: 'P-256'
  kty: 'EC'
  x: string
  y: string
}

/**
 * A flattened JWS object (RFC 7515 §7.2.2), the wire format ACME expects for
 * every POST request body.
 */
export interface FlattenedJws {
  protected: string
  payload: string
  signature: string
}

/**
 * Builds the EC JWK for an ACME account key's public half.
 *
 * Node already exports a JWK with the right field names; we just narrow it to
 * the canonical four-field shape (dropping any extra members) so the same
 * object can be embedded in a JWS header and hashed for a thumbprint.
 * @param publicKey - The public key object (a P-256 EC key).
 * @returns The EC JWK with members in canonical order.
 */
export function jwkFromKey(publicKey: KeyObject): EcJwk {
  const jwk = publicKey.export({ format: 'jwk' }) as { crv?: string, kty?: string, x?: string, y?: string }

  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y)
    throw new Error(`Expected a P-256 EC public key, got kty=${jwk.kty} crv=${jwk.crv}`)

  // Re-create in canonical member order for deterministic thumbprints.
  return { crv: 'P-256', kty: 'EC', x: jwk.x, y: jwk.y }
}

/**
 * Computes the RFC 7638 JWK thumbprint of an EC JWK.
 *
 * The thumbprint is `base64url(SHA-256(canonical-json))` where the canonical
 * JSON contains only the required members (`crv`, `kty`, `x`, `y` for EC keys)
 * in lexicographic order, with no insignificant whitespace.
 * @param jwk - The EC JWK to hash.
 * @returns The base64url-encoded SHA-256 thumbprint.
 */
export function jwkThumbprint(jwk: EcJwk): string {
  // Hand-build the JSON to guarantee member order + no whitespace, rather than
  // trusting JSON.stringify's (engine-defined, though insertion-ordered here)
  // behaviour for an arbitrary object.
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`
  return createHash('sha256').update(canonical).digest('base64url')
}

/**
 * The protected header for an ACME JWS. Either `jwk` (for newAccount) or `kid`
 * (for every subsequent request) must be present, never both.
 */
export interface JwsProtectedHeader {
  alg: 'ES256'
  nonce: string
  url: string
  jwk?: EcJwk
  kid?: string
}

/**
 * Signs an ACME request body as a flattened ES256 JWS.
 *
 * The signing input is `${protectedB64}.${payloadB64}`; the signature is the
 * raw 64-byte `r||s` concatenation (JOSE / `ieee-p1363`), base64url-encoded.
 * For a POST-as-GET request the payload is the empty string (`''`), which
 * encodes to an empty `payload` member.
 * @param params - The signing parameters.
 * @param params.protectedHeader - The JWS protected header.
 * @param params.payload - The payload: an object (JSON-serialized), or `''` for POST-as-GET.
 * @param params.privateKey - The EC P-256 private key to sign with.
 * @returns The flattened JWS object.
 */
export function signJws(params: {
  protectedHeader: JwsProtectedHeader
  payload: object | ''
  privateKey: KeyObject
}): FlattenedJws {
  const { protectedHeader, payload, privateKey } = params

  const protectedB64 = base64urlEncode(JSON.stringify(protectedHeader))
  const payloadB64 = payload === '' ? '' : base64urlEncode(JSON.stringify(payload))

  const signingInput = `${protectedB64}.${payloadB64}`
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })

  return {
    protected: protectedB64,
    payload: payloadB64,
    signature: base64urlEncode(signature),
  }
}
