# @stacksjs/tlsx

A modern TLS/HTTPS library with automation for generating, managing, and trusting local development certificates.

## Installation

```bash
bun add @stacksjs/tlsx
```

```bash
npm install @stacksjs/tlsx
```

## Usage

```typescript
import { generateCertificate, addCertToSystemTrustStore } from '@stacksjs/tlsx'

// Generate a self-signed certificate
const cert = await generateCertificate({
  domain: 'my-app.localhost',
  domains: ['my-app.localhost', 'api.my-app.localhost'],
  validityDays: 365,
})

console.log(cert.certificate) // PEM certificate
console.log(cert.privateKey)  // PEM private key

// Trust the certificate on your system
await addCertToSystemTrustStore(cert)
```

### CLI

```bash
# Generate and manage TLS certificates
tlsx generate --domain my-app.localhost
tlsx trust
```

## Features

- Self-signed certificate generation using native crypto
- Root CA certificate creation and management
- System trust store integration (macOS, Linux, Windows)
- Certificate validation and verification
- Subject Alternative Names (SANs) support for multiple domains and IPs
- Configurable key usage and extended key usage
- Custom organization, country, state, and locality attributes
- Certificate storage and retrieval
- Cross-platform CLI

## License

MIT
