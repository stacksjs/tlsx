import { Resolver } from 'node:dns/promises'
import process from 'node:process'

/**
 * Wait until a TXT record at `name` is observable with `expectedValue` before
 * telling the ACME server to validate — Let's Encrypt queries the AUTHORITATIVE
 * nameservers within seconds of `notifyChallengeReady`, but a provider's
 * `create` call returns before the record has propagated there, so validating
 * too early fails with "No TXT record found".
 *
 * Queries the apex's authoritative nameservers directly (avoids resolver
 * caching / negative-cache). Falls back to the default resolver if the
 * authoritative path isn't available. Resolves `true` once seen, `false` on
 * timeout (the caller may still proceed and let ACME retry).
 *
 * @param name - FQDN of the TXT record, e.g. `_acme-challenge.example.com`.
 * @param expectedValue - The exact TXT value that must be present.
 * @param opts - `timeoutMs` (default 120000) and `intervalMs` (default 3000).
 */
export async function waitForTxtRecord(
  name: string,
  expectedValue: string,
  opts: { timeoutMs?: number, intervalMs?: number } = {},
): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 120_000
  const intervalMs = opts.intervalMs ?? 3000
  const apex = name.split('.').slice(-2).join('.')

  // Resolve the authoritative nameserver IPs once (best-effort).
  let authoritative: Resolver | undefined
  try {
    const base = new Resolver()
    const ns = await base.resolveNs(apex)
    const ips = (await Promise.all(ns.map(h => base.resolve4(h).catch(() => [] as string[])))).flat()
    if (ips.length > 0) {
      authoritative = new Resolver()
      authoritative.setServers(ips)
    }
  }
  catch {
    // Authoritative lookup unsupported/failed — fall back to the default resolver.
  }

  const deadline = Date.now() + timeoutMs
  const resolver = authoritative ?? new Resolver()
  for (;;) {
    try {
      const records = await resolver.resolveTxt(name)
      // resolveTxt returns string[][] (each record may be split into chunks).
      if (records.some(chunks => chunks.join('') === expectedValue))
        return true
    }
    catch {
      // NXDOMAIN / not-yet-present — keep polling until the deadline.
    }
    if (Date.now() >= deadline)
      return false
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

/**
 * Abstraction over a DNS provider's API, used to publish and clean up the
 * `_acme-challenge` TXT records that satisfy the ACME dns-01 challenge.
 *
 * Implementations should be idempotent where practical: `setTxt` may be called
 * for a record that already exists, and `removeTxt` for one that's already
 * gone, without throwing.
 */
export interface DnsProvider {
  /**
   * Publishes a TXT record.
   * @param name - The fully-qualified record name, e.g. `_acme-challenge.example.com`.
   * @param value - The TXT record value (the base64url dns-01 digest).
   */
  setTxt: (name: string, value: string) => Promise<void>
  /**
   * Removes a previously-published TXT record.
   * @param name - The fully-qualified record name.
   * @param value - The TXT record value to remove.
   */
  removeTxt: (name: string, value: string) => Promise<void>
}

interface PorkbunCredentials {
  apiKey: string
  secretApiKey: string
}

interface PorkbunRecord {
  id: string
  name: string
  type: string
  content: string
}

/**
 * Splits a fully-qualified record name into the registrable apex domain and
 * the subdomain portion, as Porkbun's API addresses records by `<domain>` in
 * the URL path plus a relative `name`.
 *
 * This uses a simple "last two labels are the apex" heuristic, which is correct
 * for the common `example.com` / `*.example.com` cases tlsx targets. Multi-part
 * public suffixes (e.g. `example.co.uk`) would need a PSL; out of scope here.
 */
export function splitApexAndSubdomain(recordName: string): { apex: string, subdomain: string } {
  const labels = recordName.split('.')
  if (labels.length <= 2)
    return { apex: recordName, subdomain: '' }

  const apex = labels.slice(-2).join('.')
  const subdomain = labels.slice(0, -2).join('.')
  return { apex, subdomain }
}

/**
 * Porkbun DNS provider for the dns-01 challenge.
 *
 * Credentials come from the constructor or the `PORKBUN_API_KEY` /
 * `PORKBUN_SECRET_KEY` environment variables. Records are created via
 * `POST /dns/create/<domain>` and removed via a retrieve-then-delete by name
 * + type so we only delete the record we created.
 */
export class PorkbunDnsProvider implements DnsProvider {
  private readonly apiKey: string
  private readonly secretApiKey: string
  private readonly baseUrl: string

  constructor(credentials?: Partial<PorkbunCredentials> & { baseUrl?: string }) {
    const apiKey = credentials?.apiKey ?? process.env.PORKBUN_API_KEY
    const secretApiKey = credentials?.secretApiKey ?? process.env.PORKBUN_SECRET_KEY
    if (!apiKey || !secretApiKey)
      throw new Error('Porkbun credentials missing: set PORKBUN_API_KEY and PORKBUN_SECRET_KEY (or pass them in)')

    this.apiKey = apiKey
    this.secretApiKey = secretApiKey
    this.baseUrl = credentials?.baseUrl ?? 'https://api.porkbun.com/api/json/v3'
  }

  private async post(path: string, body: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apikey: this.apiKey, secretapikey: this.secretApiKey, ...body }),
    })
    const json = await res.json().catch(() => ({})) as { status?: string, message?: string, records?: PorkbunRecord[] }
    if (!res.ok || json.status !== 'SUCCESS')
      throw new Error(`Porkbun API ${path} failed: ${json.message ?? `HTTP ${res.status}`}`)

    return json
  }

  async setTxt(name: string, value: string): Promise<void> {
    const { apex, subdomain } = splitApexAndSubdomain(name)
    await this.post(`/dns/create/${apex}`, {
      type: 'TXT',
      name: subdomain,
      content: value,
      ttl: '600',
    })
  }

  async removeTxt(name: string, value: string): Promise<void> {
    const { apex, subdomain } = splitApexAndSubdomain(name)
    // Retrieve all TXT records for this name, then delete the matching one by id.
    const fqName = subdomain ? `${subdomain}.${apex}` : apex
    const res = await this.post(`/dns/retrieveByNameType/${apex}/TXT/${subdomain}`, {}).catch(() => null)
    const records: PorkbunRecord[] = res?.records ?? []
    for (const record of records) {
      if (record.content === value && (record.name === fqName || record.name === apex)) {
        await this.post(`/dns/delete/${apex}/${record.id}`, {}).catch(() => {})
      }
    }
  }
}
