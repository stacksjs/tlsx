/**
 * In-memory store for ACME http-01 challenge responses.
 *
 * For the http-01 challenge the ACME server fetches
 * `http://<domain>/.well-known/acme-challenge/<token>` over plain HTTP on
 * port 80 and expects the body to be the key authorization
 * (`token + '.' + thumbprint`). A webserver fronting the issuance (e.g. rpx
 * listening on :80) wires its handler to this store: the ACME client
 * registers tokens via {@link Http01Store.add}, and the webserver answers
 * requests via {@link Http01Store.get}.
 */
export class Http01Store {
  private readonly tokens = new Map<string, string>()

  /**
   * Registers a token → key-authorization mapping so the webserver can serve it.
   * @param token - The challenge token (the last path segment).
   * @param keyAuthorization - The key authorization to return as the body.
   */
  add(token: string, keyAuthorization: string): void {
    this.tokens.set(token, keyAuthorization)
  }

  /**
   * Looks up the key authorization for a token.
   * @param token - The challenge token from the request path.
   * @returns The key authorization, or `undefined` if not registered.
   */
  get(token: string): string | undefined {
    return this.tokens.get(token)
  }

  /**
   * Removes a token mapping (call after the challenge is validated).
   * @param token - The challenge token.
   */
  remove(token: string): void {
    this.tokens.delete(token)
  }

  /**
   * The `/.well-known/acme-challenge/` path prefix the webserver should match.
   */
  static readonly PATH_PREFIX = '/.well-known/acme-challenge/'

  /**
   * Convenience: resolve a full request path to its key authorization, or
   * `undefined` if the path isn't an acme-challenge path or the token is
   * unknown. Lets a webserver do `store.handlePath(req.url)` directly.
   * @param requestPath - The request path (may include a leading prefix).
   * @returns The key authorization to serve, or `undefined`.
   */
  handlePath(requestPath: string): string | undefined {
    const idx = requestPath.indexOf(Http01Store.PATH_PREFIX)
    if (idx === -1)
      return undefined

    const token = requestPath.slice(idx + Http01Store.PATH_PREFIX.length)
    return this.get(token)
  }
}

/**
 * A process-wide default http-01 store, so a long-running webserver and a
 * separately-invoked issuance routine can share challenge state without
 * threading an instance through every call.
 */
export const defaultHttp01Store: Http01Store = new Http01Store()

/**
 * An http-01 store that ALSO materializes each challenge as a file in a
 * webroot directory, named by token. Use this when an existing webserver
 * already serves `<webroot>/<token>` for the
 * `/.well-known/acme-challenge/` path (e.g. nginx, Caddy, or an rpx gateway
 * that owns :80) — issuance/renewal then needs no standalone listener.
 *
 * The directory must map to `/.well-known/acme-challenge/`: the file written
 * for `<token>` is `<webroot>/<token>`, whose body the server returns verbatim.
 *
 * @example
 * await obtainCertificate({
 *   domains: ['origin.example.com'],
 *   method: 'http-01',
 *   http01Store: new FileHttp01Store('/var/www/acme-challenge'),
 * })
 */
export class FileHttp01Store extends Http01Store {
  private readonly written = new Set<string>()

  /**
   * @param webroot - Directory mapped to `/.well-known/acme-challenge/`.
   *   Created (recursively) on construction if it does not exist.
   */
  constructor(private readonly webroot: string) {
    super()
    const fs = require('node:fs') as typeof import('node:fs')
    fs.mkdirSync(this.webroot, { recursive: true })
  }

  private filePath(token: string): string {
    const path = require('node:path') as typeof import('node:path')
    // Guard against path traversal: tokens are opaque base64url, never contain separators.
    return path.join(this.webroot, path.basename(token))
  }

  override add(token: string, keyAuthorization: string): void {
    super.add(token, keyAuthorization)
    const fs = require('node:fs') as typeof import('node:fs')
    fs.writeFileSync(this.filePath(token), keyAuthorization, 'utf8')
    this.written.add(token)
  }

  override remove(token: string): void {
    super.remove(token)
    const fs = require('node:fs') as typeof import('node:fs')
    try {
      fs.unlinkSync(this.filePath(token))
    }
    catch {
      // already gone
    }
    this.written.delete(token)
  }

  /** Remove any challenge files this store still has on disk. */
  cleanup(): void {
    for (const token of [...this.written])
      this.remove(token)
  }
}
