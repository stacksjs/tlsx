import type { KeyObject } from 'node:crypto'
import type { DnsProvider } from './dns'
import type { EcJwk, JwsProtectedHeader } from './jws'
import { createHash } from 'node:crypto'
import { Http01Store } from './http01'
import { jwkFromKey, jwkThumbprint, signJws } from './jws'

/** Let's Encrypt ACME directory URLs. */
export const LETS_ENCRYPT_STAGING_DIRECTORY = 'https://acme-staging-v02.api.letsencrypt.org/directory'
export const LETS_ENCRYPT_PRODUCTION_DIRECTORY = 'https://acme-v02.api.letsencrypt.org/directory'

/** The ACME directory document (RFC 8555 §7.1.1), the endpoints we use. */
export interface AcmeDirectory {
  newNonce: string
  newAccount: string
  newOrder: string
  revokeCert?: string
  keyChange?: string
  meta?: { termsOfService?: string }
}

interface AcmeIdentifier {
  type: 'dns'
  value: string
}

interface AcmeChallenge {
  type: string
  url: string
  status: string
  token: string
}

interface AcmeAuthorization {
  identifier: AcmeIdentifier
  status: string
  wildcard?: boolean
  challenges: AcmeChallenge[]
}

interface AcmeOrder {
  status: string
  identifiers: AcmeIdentifier[]
  authorizations: string[]
  finalize: string
  certificate?: string
}

/** An ACME problem document (RFC 7807 / RFC 8555 §6.7), surfaced on errors. */
export interface AcmeProblem {
  type?: string
  detail?: string
  status?: number
  subproblems?: AcmeProblem[]
}

/** Error thrown when the ACME server returns a problem document. */
export class AcmeError extends Error {
  readonly problem: AcmeProblem
  readonly httpStatus: number
  constructor(message: string, problem: AcmeProblem, httpStatus: number) {
    super(message)
    this.name = 'AcmeError'
    this.problem = problem
    this.httpStatus = httpStatus
  }
}

interface AcmeResponse<T> {
  status: number
  headers: Headers
  body: T
  location?: string
}

/**
 * Low-level ACME (RFC 8555) protocol client over `fetch`. Handles directory
 * discovery, nonce tracking, JWS-signed POSTs, account creation, ordering,
 * challenge fulfilment, finalization, and certificate download.
 *
 * One `AcmeClient` instance corresponds to one account key. After
 * {@link AcmeClient.newAccount} the account `kid` is remembered and used for
 * all subsequent requests.
 */
export class AcmeClient {
  private readonly directoryUrl: string
  private readonly accountKey: KeyObject
  private readonly jwk: EcJwk
  private readonly thumbprint: string

  private directoryCache?: AcmeDirectory
  private nonce?: string
  private accountKid?: string

  /**
   * @param params - Client parameters.
   * @param params.directoryUrl - The ACME directory URL (staging or production).
   * @param params.accountKey - The EC P-256 account private key.
   * @param params.accountPublicKey - The matching public key (for the JWK / thumbprint).
   */
  constructor(params: { directoryUrl: string, accountKey: KeyObject, accountPublicKey: KeyObject }) {
    this.directoryUrl = params.directoryUrl
    this.accountKey = params.accountKey
    this.jwk = jwkFromKey(params.accountPublicKey)
    this.thumbprint = jwkThumbprint(this.jwk)
  }

  /** The account key's RFC 7638 thumbprint (used to build key authorizations). */
  get keyThumbprint(): string {
    return this.thumbprint
  }

  /** The current account `kid` (resource URL), set after {@link newAccount}. */
  get kid(): string | undefined {
    return this.accountKid
  }

  /** Fetches (and caches) the ACME directory document. */
  async directory(): Promise<AcmeDirectory> {
    if (this.directoryCache)
      return this.directoryCache

    const res = await fetch(this.directoryUrl)
    if (!res.ok)
      throw new Error(`Failed to fetch ACME directory: HTTP ${res.status}`)

    this.directoryCache = await res.json() as AcmeDirectory
    return this.directoryCache
  }

  /** Fetches a fresh anti-replay nonce via HEAD on `newNonce`. */
  async newNonce(): Promise<string> {
    const dir = await this.directory()
    const res = await fetch(dir.newNonce, { method: 'HEAD' })
    const nonce = res.headers.get('replay-nonce')
    if (!nonce)
      throw new Error('ACME server did not return a Replay-Nonce')

    this.nonce = nonce
    return nonce
  }

  private async ensureNonce(): Promise<string> {
    if (this.nonce) {
      const n = this.nonce
      this.nonce = undefined
      return n
    }
    return this.newNonce()
  }

  /**
   * Sends a JWS-signed POST to an ACME endpoint, tracking the Replay-Nonce
   * from the response and surfacing ACME problem documents as {@link AcmeError}.
   */
  private async signedPost<T = any>(params: {
    url: string
    payload: object | ''
    useJwk?: boolean
  }): Promise<AcmeResponse<T>> {
    const { url, payload, useJwk } = params
    const nonce = await this.ensureNonce()

    const protectedHeader: JwsProtectedHeader = { alg: 'ES256', nonce, url }
    if (useJwk)
      protectedHeader.jwk = this.jwk
    else
      protectedHeader.kid = this.requireKid()

    const jws = signJws({ protectedHeader, payload, privateKey: this.accountKey })

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/jose+json' },
      body: JSON.stringify(jws),
    })

    // Track the replay nonce from EVERY response.
    const newNonce = res.headers.get('replay-nonce')
    if (newNonce)
      this.nonce = newNonce

    const contentType = res.headers.get('content-type') ?? ''
    let body: any
    if (contentType.includes('application/pem-certificate-chain') || contentType.startsWith('text/')) {
      body = await res.text()
    }
    else {
      const text = await res.text()
      body = text ? JSON.parse(text) : {}
    }

    if (res.status >= 400) {
      const problem = (body ?? {}) as AcmeProblem
      throw new AcmeError(
        `ACME request to ${url} failed (HTTP ${res.status}): ${problem.type ?? ''} ${problem.detail ?? ''}`.trim(),
        problem,
        res.status,
      )
    }

    return {
      status: res.status,
      headers: res.headers,
      body: body as T,
      location: res.headers.get('location') ?? undefined,
    }
  }

  private requireKid(): string {
    if (!this.accountKid)
      throw new Error('No ACME account; call newAccount() first')
    return this.accountKid
  }

  /**
   * Creates (or recovers) an ACME account, agreeing to the terms of service.
   * The returned account URL is stored as the `kid` for subsequent requests.
   * @param params - Account parameters.
   * @param params.email - Optional contact email (becomes a `mailto:` contact).
   * @returns The account URL (kid).
   */
  async newAccount(params: { email?: string } = {}): Promise<string> {
    const dir = await this.directory()
    const payload: Record<string, unknown> = { termsOfServiceAgreed: true }
    if (params.email)
      payload.contact = [`mailto:${params.email}`]

    const res = await this.signedPost({ url: dir.newAccount, payload, useJwk: true })
    if (!res.location)
      throw new Error('ACME newAccount did not return an account URL (Location header)')

    this.accountKid = res.location
    return this.accountKid
  }

  /**
   * Creates a new certificate order for the given DNS identifiers.
   * @param domains - The DNS names to include (may contain wildcards).
   * @returns The order resource plus its URL.
   */
  async newOrder(domains: string[]): Promise<{ order: AcmeOrder, orderUrl: string }> {
    const dir = await this.directory()
    const payload = {
      identifiers: domains.map(value => ({ type: 'dns', value })),
    }
    const res = await this.signedPost<AcmeOrder>({ url: dir.newOrder, payload })
    if (!res.location)
      throw new Error('ACME newOrder did not return an order URL (Location header)')

    return { order: res.body, orderUrl: res.location }
  }

  /** Fetches an authorization resource (via POST-as-GET). */
  async getAuthorization(authzUrl: string): Promise<AcmeAuthorization> {
    const res = await this.signedPost<AcmeAuthorization>({ url: authzUrl, payload: '' })
    return res.body
  }

  /**
   * Computes the key authorization for a challenge token:
   * `token + '.' + base64url(SHA-256(accountKey JWK))`.
   * @param token - The challenge token.
   * @returns The key authorization string.
   */
  keyAuthorization(token: string): string {
    return `${token}.${this.thumbprint}`
  }

  /**
   * Computes the dns-01 TXT record value: `base64url(SHA-256(keyAuth))`.
   * @param token - The challenge token.
   * @returns The TXT record value to publish at `_acme-challenge.<host>`.
   */
  dns01TxtValue(token: string): string {
    return createHash('sha256').update(this.keyAuthorization(token)).digest('base64url')
  }

  /** Notifies the ACME server that a challenge is ready to be validated. */
  async notifyChallengeReady(challengeUrl: string): Promise<void> {
    // POST with an empty object payload `{}` triggers validation (RFC 8555 §7.5.1).
    await this.signedPost({ url: challengeUrl, payload: {} })
  }

  /**
   * Polls an authorization until it reaches `valid`, throwing on `invalid` or
   * timeout.
   * @param authzUrl - The authorization URL.
   * @param opts - Polling options.
   * @param opts.timeoutMs - Overall timeout (default 60s).
   * @param opts.intervalMs - Initial poll interval (default 2s, capped at 10s with backoff).
   */
  async pollAuthorization(authzUrl: string, opts: { timeoutMs?: number, intervalMs?: number } = {}): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 60_000
    let interval = opts.intervalMs ?? 2_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const authz = await this.getAuthorization(authzUrl)
      if (authz.status === 'valid')
        return
      if (authz.status === 'invalid') {
        const failed = authz.challenges.find(c => c.status === 'invalid') as (AcmeChallenge & { error?: AcmeProblem }) | undefined
        throw new AcmeError(
          `Authorization for ${authz.identifier.value} became invalid: ${failed?.error?.detail ?? 'unknown reason'}`,
          failed?.error ?? {},
          0,
        )
      }
      await sleep(interval)
      interval = Math.min(interval * 1.5, 10_000)
    }
    throw new Error(`Timed out waiting for authorization ${authzUrl} to become valid`)
  }

  /**
   * Finalizes an order by submitting the base64url-encoded CSR.
   * @param finalizeUrl - The order's finalize URL.
   * @param csrBase64url - The base64url-encoded DER CSR.
   * @returns The updated order resource.
   */
  async finalizeOrder(finalizeUrl: string, csrBase64url: string): Promise<AcmeOrder> {
    const res = await this.signedPost<AcmeOrder>({ url: finalizeUrl, payload: { csr: csrBase64url } })
    return res.body
  }

  /** Fetches an order resource (via POST-as-GET). */
  async getOrder(orderUrl: string): Promise<AcmeOrder> {
    const res = await this.signedPost<AcmeOrder>({ url: orderUrl, payload: '' })
    return res.body
  }

  /**
   * Polls an order until it reaches `valid` (and exposes a `certificate` URL),
   * throwing on `invalid` or timeout.
   * @param orderUrl - The order URL.
   * @param opts - Polling options.
   * @param opts.timeoutMs - Overall timeout (default 60s).
   * @param opts.intervalMs - Initial poll interval (default 2s, backs off to 10s).
   * @returns The certificate download URL.
   */
  async pollOrder(orderUrl: string, opts: { timeoutMs?: number, intervalMs?: number } = {}): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? 60_000
    let interval = opts.intervalMs ?? 2_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const order = await this.getOrder(orderUrl)
      if (order.status === 'valid') {
        if (!order.certificate)
          throw new Error('ACME order is valid but has no certificate URL')
        return order.certificate
      }
      if (order.status === 'invalid')
        throw new Error(`ACME order ${orderUrl} became invalid`)

      await sleep(interval)
      interval = Math.min(interval * 1.5, 10_000)
    }
    throw new Error(`Timed out waiting for order ${orderUrl} to become valid`)
  }

  /**
   * Downloads the issued certificate chain (PEM) via POST-as-GET.
   * @param certificateUrl - The certificate URL from the finalized order.
   * @returns The full PEM chain (leaf first, then intermediates).
   */
  async downloadCertificate(certificateUrl: string): Promise<string> {
    const res = await this.signedPost<string>({ url: certificateUrl, payload: '' })
    return typeof res.body === 'string' ? res.body : String(res.body)
  }

  /**
   * Selects a challenge of the requested type from an authorization.
   * @param authz - The authorization resource.
   * @param type - `'dns-01'` or `'http-01'`.
   * @returns The matching challenge.
   */
  static selectChallenge(authz: AcmeAuthorization, type: 'dns-01' | 'http-01'): AcmeChallenge {
    const challenge = authz.challenges.find(c => c.type === type)
    if (!challenge)
      throw new Error(`No ${type} challenge available for ${authz.identifier.value}`)
    return challenge
  }
}

/** Splits a PEM chain into the leaf certificate and the remaining chain. */
export function splitPemChain(pemChain: string): { certPem: string, chainPem: string } {
  const blocks = pemChain.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n?/g) ?? []
  const first = blocks[0]
  if (!first)
    return { certPem: `${pemChain.trim()}\n`, chainPem: '' }

  const certPem = `${first.trim()}\n`
  const chainPem = blocks.slice(1).map(b => b.trim()).join('\n')
  return { certPem, chainPem: chainPem ? `${chainPem}\n` : '' }
}

/** The `_acme-challenge` host for a dns-01 identifier, stripping a leading `*.`. */
export function dns01RecordName(identifier: string): string {
  const host = identifier.startsWith('*.') ? identifier.slice(2) : identifier
  return `_acme-challenge.${host}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Re-exported so callers wiring an http-01 webserver have the prefix handy.
export { Http01Store }
