# Multi-domain Support

`tlsx` provides robust support for securing multiple domains with a single certificate, making it ideal for complex local development environments.

## What is Multi-domain Support?

Multi-domain support allows a single SSL/TLS certificate to secure multiple different domain names. This is implemented using Subject Alternative Names (SANs) within the certificate, which list all domains the certificate is valid for.

## Benefits of Multi-domain Certificates

- **Simplified Management**: Manage one certificate instead of many
- **Reduced Overhead**: No need to generate and install multiple certificates
- **Streamlined Development**: Test multiple domains or services with a single certificate
- **Microservices Support**: Ideal for local microservice architectures with multiple domain names

## How tlsx Implements Multi-domain Support

`tlsx` allows you to specify multiple domains when generating a certificate, and it will automatically add all specified domains to the certificate's Subject Alternative Names (SANs).

## Example Usage

Using the library:

```ts
import { generateCertificate } from '@stacksjs/tlsx'

// Generate a certificate for multiple domains
const cert = await generateCertificate({
  domains: ['api.local', 'app.local', 'admin.local'],
  rootCA: existingCA,
})
```

Using the CLI:

```bash
tlsx secure -d "api.local,app.local,admin.local"
```

## Combining with Wildcard Domains

You can combine multi-domain support with wildcard domains for even more flexibility:

```ts
const cert = await generateCertificate({
  domains: ['api.local', 'app.local', '*.services.local'],
  rootCA: existingCA,
})
```

CLI:

```bash
tlsx secure -d "api.local,app.local,*.services.local"
```

## Related Features

- [Wildcard Domains](/features/wildcard-domains)
- [SSL Support](/features/ssl-support)
