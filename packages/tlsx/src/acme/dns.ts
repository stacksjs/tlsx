import process from 'node:process'

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
