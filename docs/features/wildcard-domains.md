# Wildcard Domains

`tlsx` supports wildcard domain certificates, allowing you to secure multiple subdomains with a single certificate.

## What are Wildcard Domains?

A wildcard certificate is a digital certificate that can be used with multiple subdomains of a domain. For example, a single wildcard certificate for `*.example.com` can secure `api.example.com`, `app.example.com`, `store.example.com`, and any other subdomain of `example.com`.

## Benefits of Wildcard Domains

- **Convenience**: Generate one certificate that works for all subdomains
- **Flexibility**: Add new subdomains without generating new certificates
- **Simplified Management**: Maintain fewer certificates

## How tlsx Handles Wildcard Domains

`tlsx` can generate certificates with wildcard domains as Subject Alternative Names (SANs), ensuring that your certificate works for any subdomain you might need during development.

## Example Usage

Using the library:

```ts
import { generateCertificate } from '@stacksjs/tlsx'

// Generate a certificate with wildcard domain
const cert = await generateCertificate({
  domains: ['*.example.local'],
  rootCA: existingCA,
})
```

Using the CLI:

```bash
tlsx secure -d "*.example.local"
```

## Limitations

While wildcard certificates are powerful, they have some limitations:

- They only cover one level of subdomains (e.g., `*.example.com` covers `sub.example.com` but not `sub.sub.example.com`)
- For multi-level wildcards, you would need to specify each level (e.g., `*.example.com` and `*.*.example.com`)

## Related Features

- [Multi-domain Support](/features/multi-domain)
- [SSL Support](/features/ssl-support)
