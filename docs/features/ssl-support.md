# SSL Support

`tlsx` provides robust SSL support out of the box, making HTTPS available by default for your local development environment.

## What is SSL Support?

SSL (Secure Sockets Layer) and its successor TLS (Transport Layer Security) are protocols that provide secure communication over a computer network. When implemented on a website, it enables the HTTPS protocol, which creates an encrypted connection between the web server and the browser.

## Benefits of SSL in Local Development

- **Browser Compatibility**: Modern browsers often require HTTPS for certain APIs (like Service Workers, camera access, etc.)
- **Realistic Development Environment**: Match your production environment more closely
- **Security Testing**: Test security-related features in a secure context
- **No Security Warnings**: Avoid browser warnings about insecure connections

## How tlsx Implements SSL

`tlsx` generates and manages self-signed SSL certificates that are automatically trusted by your system. This means:

1. No more browser security warnings during local development
2. Your localhost server can run on HTTPS without additional configuration
3. All certificates are managed for you with zero manual steps

## Example Usage

```ts
import { generateCertificate } from '@stacksjs/tlsx'

// Generate a certificate for localhost
const cert = await generateCertificate({
  domain: 'localhost',
  rootCA: existingCA,
})
```

With the CLI:

```bash
tlsx secure localhost
```

## Related Features

- [Wildcard Domains](/features/wildcard-domains)
- [Multi-domain Support](/features/multi-domain)
- [System Trust Store Integration](/features/system-trust-store)