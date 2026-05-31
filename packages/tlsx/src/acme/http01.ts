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
