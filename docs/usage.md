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
  domains: ['example.com', 'api.example.com', '_.example.com'],
  rootCA: existingCA,
  validityDays: 365,
})

// Generate a certificate with both primary domain and additional domains
const combinedCert = await generateCertificate({
  domain: 'example.com',
  domains: ['api.example.com', '_.example.com'],
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
tlsx secure -d "example.com,api.example.com,_.example.com"

# Generate certificate with primary domain and additional domains
tlsx secure example.com -d "api.example.com,_.example.com"

# Generate certificate with custom validity and organization
tlsx secure example.com --validity-days 365 --organization-name "My Company"

# Install the local Root CA into the system trust store (mkcert-style, idempotent)
tlsx install

# Export the Root CA for another device: pem (default), der, or an iOS mobileconfig profile
tlsx export-ca --format mobileconfig --out ~/Desktop/root-ca.mobileconfig

# Print the trust steps for a platform (macos, ios, windows, debian, rhel, android, linux-nss)
tlsx trust-instructions --platform ios

# Show all available options
tlsx secure --help

# Show version
tlsx version
```

`tlsx install` works on a headless machine. On Linux it writes the CA anchor
into the directory the distribution reads (`/usr/local/share/ca-certificates`
on Debian and Ubuntu, `/etc/pki/ca-trust/source/anchors` on the RHEL family)
and runs that distribution's update command, so `curl`, Bun and system services
trust it without a browser profile being present. Running it a second time
costs nothing: the CA is looked up in the system bundle by fingerprint first,
and an already-trusted CA is skipped without a sudo prompt.

`tlsx export-ca` hands the same CA to another device, and
`tlsx trust-instructions` prints the steps for that platform. On iOS,
installing the exported profile is only half of it: full trust has to be
enabled afterwards under Settings, General, About, Certificate Trust Settings.
See [Trust Store Management](/features/trust-store-management) for both.
