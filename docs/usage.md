# Usage

There are two ways of using this reverse proxy: _as a library or as a CLI._

## Library

Given the npm package is installed:

```ts
import type { AddCertOptions, CAOptions, CertificateOptions, TlsConfig, TlsOptions } from '@stacksjs/tlsx'
import { addCertToSystemTrustStoreAndSaveCerts, config, forge, generateCert, pki, storeCertificate, tls } from '@stacksjs/tlsx'

// Generate a certificate for a single domain
const cert = await generateCertificate({
  domain: 'example.com',
  rootCA: existingCA,
  validityDays: 365,
})

// Generate a certificate for multiple domains
const multiDomainCert = await generateCertificate({
  domains: ['example.com', 'api.example.com', '*.example.com'],
  rootCA: existingCA,
  validityDays: 365,
})

// Generate a certificate with both primary domain and additional domains
const combinedCert = await generateCertificate({
  domain: 'example.com',
  domains: ['api.example.com', '*.example.com'],
  rootCA: existingCA,
  validityDays: 365,
})

// Store and trust the certificate
await addCertToSystemTrustStoreAndSaveCert(cert, rootCA.certificate)
```

## CLI

```bash
# Generate certificate for a single domain
tlsx secure example.com

# Generate certificate for multiple domains
tlsx secure -d "example.com,api.example.com,*.example.com"

# Generate certificate with primary domain and additional domains
tlsx secure example.com -d "api.example.com,*.example.com"

# Generate certificate with custom validity and organization
tlsx secure example.com --validity-days 365 --organization-name "My Company"

# Show all available options
tlsx secure --help

# Show version
tlsx version
```
