# Certificate Generation

tlsx provides automated SSL/TLS certificate generation for development and testing environments.

## Overview

Certificate generation in tlsx creates:

- **Root CA Certificate**: A Certificate Authority that signs your host certificates
- **Host Certificate**: The certificate for your specific domain(s)
- **Private Key**: Used for TLS handshake encryption

## Basic Usage

### CLI

Generate a certificate for a single domain:

```bash
tlsx secure example.localhost
```

This creates:
- `~/.stacks/ssl/example.localhost.ca.crt` - Root CA certificate
- `~/.stacks/ssl/example.localhost.crt` - Host certificate
- `~/.stacks/ssl/example.localhost.crt.key` - Private key

### Library

```ts
import { generateCertificate } from '@stacksjs/tlsx'

const cert = await generateCertificate({
  domain: 'example.localhost',
  validityDays: 365,
})

console.log(cert.certificate) // PEM-encoded certificate
console.log(cert.privateKey) // PEM-encoded private key
```

## Multi-Domain Certificates

### Generate for Multiple Domains

```bash
# CLI
tlsx secure -d "example.com,api.example.com,admin.example.com"
```

```ts
// Library
const cert = await generateCertificate({
  domains: ['example.com', 'api.example.com', 'admin.example.com'],
  validityDays: 365,
})
```

### Primary Domain with Additional Domains

```bash
# CLI
tlsx secure example.com -d "api.example.com,*.example.com"
```

```ts
// Library
const cert = await generateCertificate({
  domain: 'example.com', // Primary domain (CN)
  domains: ['api.example.com', '*.example.com'], // Additional SANs
  validityDays: 365,
})
```

## Wildcard Certificates

Generate certificates that cover all subdomains:

```bash
# CLI
tlsx secure "*.example.localhost"
```

```ts
// Library
const cert = await generateCertificate({
  domain: '*.example.localhost',
  domains: ['example.localhost'], // Include base domain
  validityDays: 365,
})
```

This covers:
- `app.example.localhost`
- `api.example.localhost`
- `admin.example.localhost`
- Any other subdomain

## Certificate Options

### Validity Period

```bash
# CLI
tlsx secure example.localhost --validity-days 365
```

```ts
// Library
const cert = await generateCertificate({
  domain: 'example.localhost',
  validityDays: 365, // 1 year
})
```

### Organization Information

```bash
# CLI
tlsx secure example.localhost \
  --organization-name "My Company" \
  --country-name "US" \
  --state-name "California" \
  --locality-name "San Francisco"
```

```ts
// Library
const cert = await generateCertificate({
  domain: 'example.localhost',
  organizationName: 'My Company',
  countryName: 'US',
  stateName: 'California',
  localityName: 'San Francisco',
})
```

### Custom Output Paths

```bash
# CLI
tlsx secure example.localhost \
  --cert-path ./certs/cert.crt \
  --key-path ./certs/key.pem \
  --ca-cert-path ./certs/ca.crt
```

```ts
// Library
const cert = await generateCertificate({
  domain: 'example.localhost',
  certPath: './certs/cert.crt',
  keyPath: './certs/key.pem',
  caCertPath: './certs/ca.crt',
})
```

## Subject Alternative Names (SANs)

### IP Addresses

Include IP addresses in the certificate:

```ts
const cert = await generateCertificate({
  domain: 'example.localhost',
  altNameIPs: ['127.0.0.1', '192.168.1.100', '::1'],
})
```

### Additional URIs

Include additional URIs:

```ts
const cert = await generateCertificate({
  domain: 'example.localhost',
  altNameURIs: ['localhost', 'example.local'],
})
```

## Using Existing Root CA

Use an existing CA to sign certificates:

```ts
import { generateCertificate, loadCA } from '@stacksjs/tlsx'

// Load existing CA
const rootCA = await loadCA({
  certPath: '~/.stacks/ssl/my-ca.crt',
  keyPath: '~/.stacks/ssl/my-ca.key',
})

// Generate certificate signed by existing CA
const cert = await generateCertificate({
  domain: 'example.localhost',
  rootCA,
  validityDays: 365,
})
```

## Certificate Storage

### Default Storage Location

Certificates are stored in `~/.stacks/ssl/` by default:

```
~/.stacks/ssl/
├── example.localhost.ca.crt     # Root CA certificate
├── example.localhost.ca.key     # Root CA private key
├── example.localhost.crt        # Host certificate
└── example.localhost.crt.key    # Host private key
```

### Custom Storage

```ts
const cert = await generateCertificate({
  domain: 'example.localhost',
  certPath: '/custom/path/cert.crt',
  keyPath: '/custom/path/key.pem',
  caCertPath: '/custom/path/ca.crt',
})

// Or save manually
await storeCertificate(cert, {
  certPath: '/custom/path/cert.crt',
  keyPath: '/custom/path/key.pem',
})
```

## Certificate Information

### View Certificate Details

```bash
# CLI
tlsx info path/to/cert.crt
```

```ts
// Library
import { getCertificateInfo } from '@stacksjs/tlsx'

const info = await getCertificateInfo('./cert.crt')
console.log(info)
// {
//   subject: { CN: 'example.localhost', O: 'My Company' },
//   issuer: { CN: 'tlsx CA', O: 'stacksjs.org' },
//   validFrom: '2024-01-01T00:00:00.000Z',
//   validTo: '2025-01-01T00:00:00.000Z',
//   serialNumber: '...',
//   fingerprint: '...',
// }
```

### List All Certificates

```bash
tlsx list
```

Output:
```
Domain                  Expires        Status
example.localhost       2025-01-01     Valid
api.localhost           2024-06-15     Expiring Soon
old.localhost           2024-01-01     Expired
```

## Best Practices

### Development Certificates

- Use short validity periods (90-180 days)
- Generate separate certificates per project
- Use wildcard certs for microservices

### Certificate Naming

- Use `.localhost` suffix for local development
- Use descriptive names matching your project
- Keep consistent naming across environments

### Security

- Never commit private keys to version control
- Use different CAs for different environments
- Rotate certificates regularly

## Next Steps

- [Auto-Renewal](/features/auto-renewal) - Automatic certificate renewal
- [Root CA](/features/root-ca) - Managing Certificate Authorities
- [Trust Store](/features/trust-store-management) - System trust store integration
