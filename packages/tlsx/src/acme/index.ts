import type { KeyObject } from 'node:crypto'
import type { DnsProvider } from './dns'
import { waitForTxtRecord } from './dns'
import { generateKeyPairSync, X509Certificate } from 'node:crypto'
import { AcmeClient, dns01RecordName, LETS_ENCRYPT_PRODUCTION_DIRECTORY, LETS_ENCRYPT_STAGING_DIRECTORY, splitPemChain } from './client'
import { buildCsrBase64url } from './csr'
import { defaultHttp01Store, Http01Store } from './http01'

export * from './base64url'
export * from './client'
export * from './csr'
export * from './dns'
export * from './fetch'
export * from './http01'
export * from './jws'

/** Options for {@link obtainCertificate}. */
export interface ObtainCertificateOptions {
  /** DNS names to include on the certificate. Wildcards (`*.example.com`) are allowed with dns-01. */
  domains: string[]
  /** Challenge method. `dns-01` is required for wildcards; `http-01` needs a webserver on :80. */
  method: 'dns-01' | 'http-01'
  /** DNS provider used to publish/clean up `_acme-challenge` TXT records (required for dns-01). */
  dnsProvider?: DnsProvider
  /** http-01 challenge store the serving webserver reads from (defaults to the shared store). */
  http01Store?: Http01Store
  /** Existing account key PEM (PKCS#8) to reuse; if omitted a fresh P-256 key is generated. */
  accountKeyPem?: string
  /** Override the ACME directory URL entirely (takes precedence over `staging`). */
  directoryUrl?: string
  /** Use Let's Encrypt staging (default) vs production. Set `false` for real certs. */
  staging?: boolean
  /** Contact email for the ACME account. */
  email?: string
  /** Per-step poll/timeout overrides. */
  timeoutMs?: number
  /** Hard timeout per ACME HTTP request (default 30000ms) — bounds the flow so a
   * stalled connection can never hang issuance (and callers' in-flight dedupe) forever. */
  requestTimeoutMs?: number
  /** Max time to wait for a dns-01 TXT record to propagate before validating (default 120000ms). */
  dnsPropagationTimeoutMs?: number
}

/** Result of {@link obtainCertificate}. */
export interface ObtainCertificateResult {
  /** The leaf certificate, PEM. */
  certPem: string
  /** The certificate private key, PEM (PKCS#8). */
  keyPem: string
  /** The intermediate chain, PEM (may be empty). */
  chainPem: string
  /** The full chain (leaf + intermediates), PEM — handy for servers that want a bundle. */
  fullChainPem: string
  /** The account key, PEM — persist this to reuse the ACME account next time. */
  accountKeyPem: string
  /** The certificate's notAfter (expiry) date. */
  notAfter: Date
}

function loadOrCreateAccountKey(accountKeyPem?: string): { privateKey: KeyObject, publicKey: KeyObject, pem: string } {
  if (accountKeyPem) {
    const { createPrivateKey, createPublicKey } = require('node:crypto') as typeof import('node:crypto')
    const privateKey = createPrivateKey(accountKeyPem)
    const publicKey = createPublicKey(privateKey.export({ format: 'pem', type: 'pkcs8' }))
    return { privateKey, publicKey, pem: accountKeyPem }
  }
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  return { privateKey, publicKey, pem }
}

/**
 * Obtains (or renews) a real certificate from an ACME CA (Let's Encrypt by
 * default) for the given domains, driving the full RFC 8555 flow:
 * directory → nonce → account → order → authorizations → challenges →
 * finalize → download.
 *
 * For `dns-01` (required for wildcards) a {@link DnsProvider} publishes the
 * `_acme-challenge` TXT records and removes them afterwards. For `http-01` the
 * challenge responses are registered in an {@link Http01Store} that a webserver
 * on port 80 must serve.
 *
 * Defaults to **Let's Encrypt staging** — pass `staging: false` for production
 * (rate-limited, real, trusted certs).
 * @param options - The issuance options.
 * @returns The leaf cert, key, chain, account key, and expiry.
 */
export async function obtainCertificate(options: ObtainCertificateOptions): Promise<ObtainCertificateResult> {
  const { domains, method } = options
  if (domains.length === 0)
    throw new Error('obtainCertificate requires at least one domain')

  if (method === 'dns-01' && !options.dnsProvider)
    throw new Error('dns-01 requires a dnsProvider to publish _acme-challenge TXT records')

  const hasWildcard = domains.some(d => d.startsWith('*.'))
  if (hasWildcard && method !== 'dns-01')
    throw new Error('Wildcard certificates require the dns-01 challenge method')

  const directoryUrl = options.directoryUrl
    ?? (options.staging === false ? LETS_ENCRYPT_PRODUCTION_DIRECTORY : LETS_ENCRYPT_STAGING_DIRECTORY)

  const account = loadOrCreateAccountKey(options.accountKeyPem)
  const client = new AcmeClient({
    directoryUrl,
    accountKey: account.privateKey,
    accountPublicKey: account.publicKey,
    requestTimeoutMs: options.requestTimeoutMs,
  })

  await client.newAccount({ email: options.email })

  const { order, orderUrl } = await client.newOrder(domains)

  const http01Store = options.http01Store ?? defaultHttp01Store
  // Track what we published so we can always clean up, even on failure.
  const dnsCleanups: Array<{ name: string, value: string }> = []
  const httpCleanups: string[] = []

  try {
    for (const authzUrl of order.authorizations) {
      const authz = await client.getAuthorization(authzUrl)
      if (authz.status === 'valid')
        continue // already authorized (e.g. cached from a prior order)

      const challenge = AcmeClient.selectChallenge(authz, method)

      if (method === 'dns-01') {
        const recordName = dns01RecordName(authz.identifier.value)
        const recordValue = client.dns01TxtValue(challenge.token)
        await options.dnsProvider!.setTxt(recordName, recordValue)
        dnsCleanups.push({ name: recordName, value: recordValue })
        // Wait for the TXT to land on the authoritative NS before asking ACME
        // to validate — otherwise Let's Encrypt checks too early and the authz
        // goes invalid ("No TXT record found"). Best-effort: proceed on timeout
        // and let ACME's own retries cover the rest.
        await waitForTxtRecord(recordName, recordValue, { timeoutMs: options.dnsPropagationTimeoutMs ?? 120_000 })
      }
      else {
        http01Store.add(challenge.token, client.keyAuthorization(challenge.token))
        httpCleanups.push(challenge.token)
      }

      await client.notifyChallengeReady(challenge.url)
      await client.pollAuthorization(authzUrl, { timeoutMs: options.timeoutMs })
    }

    // Generate the certificate key + CSR and finalize.
    const { privateKey: certPriv, publicKey: certPub } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const csr = buildCsrBase64url({ domains, publicKey: certPub, privateKey: certPriv })

    await client.finalizeOrder(order.finalize, csr)
    const certificateUrl = await client.pollOrder(orderUrl, { timeoutMs: options.timeoutMs })
    const pemChain = await client.downloadCertificate(certificateUrl)

    const { certPem, chainPem } = splitPemChain(pemChain)
    const fullChainPem = chainPem ? `${certPem}${chainPem}` : certPem
    const keyPem = certPriv.export({ format: 'pem', type: 'pkcs8' }).toString()
    const notAfter = new Date(new X509Certificate(certPem).validTo)

    return { certPem, keyPem, chainPem, fullChainPem, accountKeyPem: account.pem, notAfter }
  }
  finally {
    for (const { name, value } of dnsCleanups)
      await options.dnsProvider?.removeTxt(name, value).catch(() => {})
    for (const token of httpCleanups)
      http01Store.remove(token)
  }
}
