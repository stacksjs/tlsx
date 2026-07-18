/**
 * Default ceiling for a single ACME-related HTTP request, in milliseconds.
 *
 * Every request in the issuance flow (directory, nonce, JWS POSTs, DNS
 * provider calls) must be bounded: a stalled or black-holed connection would
 * otherwise hang the flow forever — and for on-demand cert managers that
 * de-dupe concurrent issuances per host, a never-settling attempt wedges the
 * host (no retry, no adopt-from-disk) until process restart.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/**
 * `fetch` bounded by a hard timeout (default {@link DEFAULT_REQUEST_TIMEOUT_MS}).
 *
 * When the request does not complete within `timeoutMs`, the underlying
 * request is aborted and this rejects with an `AcmeRequestTimeoutError` (an
 * `Error` whose message names the URL and the timeout) instead of hanging on
 * a stalled connection forever.
 *
 * @param url - The request URL.
 * @param init - Standard fetch init (method, headers, body).
 * @param timeoutMs - Hard timeout for the request, in milliseconds.
 * @returns The fetch response.
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  }
  catch (err) {
    // AbortSignal.timeout() aborts with a TimeoutError DOMException; give the
    // caller a message that says WHAT timed out and after how long. Check by
    // `name` — DOMException is not an `instanceof Error` on every runtime.
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'TimeoutError') {
      const timeoutError = new Error(`ACME HTTP request to ${url} timed out after ${timeoutMs}ms`)
      timeoutError.name = 'AcmeRequestTimeoutError'
      throw timeoutError
    }
    throw err
  }
}
