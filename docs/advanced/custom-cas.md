# Custom CAs

This guide covers advanced Certificate Authority (CA) configuration and management in tlsx.

## Overview

Custom CAs enable:

- **Enterprise Integration**: Use your organization's CA
- **Team Sharing**: Share a CA across development teams
- **Environment Separation**: Different CAs for dev/staging/prod
- **Compliance**: Meet security requirements

## Creating Custom CAs

### Basic CA Creation

```ts
import { createRootCA } from '@stacksjs/tlsx'

const ca = await createRootCA({
  commonName: 'My Custom CA',
  organizationName: 'My Company',
  countryName: 'US',
  validityDays: 3650, // 10 years
})
```

### Advanced CA Options

```ts
const ca = await createRootCA({
  // Identity
  commonName: 'My Enterprise Development CA',
  organizationName: 'My Company, Inc.',
  organizationalUnitName: 'IT Security',
  countryName: 'US',
  stateName: 'California',
  localityName: 'San Francisco',

  // Validity
  validityDays: 3650,

  // Key configuration
  keySize: 4096,
  keyAlgorithm: 'RSA',

  // Extensions
  basicConstraints: {
    ca: true,
    pathLen: 1, // Can sign intermediate CAs
  },

  keyUsage: [
    'digitalSignature',
    'keyCertSign',
    'cRLSign',
  ],

  // Output
  certPath: './ca/root-ca.crt',
  keyPath: './ca/root-ca.key',
})
```

## CA Hierarchy

### Two-Tier CA Structure

```ts
import { createRootCA, createIntermediateCA, generateCertificate } from '@stacksjs/tlsx'

// 1. Create Root CA (offline, high security)
const rootCA = await createRootCA({
  commonName: 'My Root CA',
  validityDays: 7300, // 20 years
  keySize: 4096,
})

// 2. Create Intermediate CA (online, for signing)
const intermediateCA = await createIntermediateCA({
  commonName: 'My Intermediate CA',
  validityDays: 1825, // 5 years
  keySize: 4096,
  signingCA: rootCA,
})

// 3. Generate host certificates
const cert = await generateCertificate({
  domain: 'app.localhost',
  rootCA: intermediateCA,
  validityDays: 365,
})
```

### Chain File

Create a certificate chain file:

```ts
import { createCertificateChain } from '@stacksjs/tlsx'

await createCertificateChain({
  certificates: [
    './ca/root-ca.crt',
    './ca/intermediate-ca.crt',
    './certs/host.crt',
  ],
  output: './certs/chain.pem',
})
```

## External CA Integration

### Using Enterprise CA

```ts
import { generateCertificate, loadCA } from '@stacksjs/tlsx'

// Load your organization's CA
const enterpriseCA = await loadCA({
  certPath: '/path/to/enterprise-ca.crt',
  keyPath: '/path/to/enterprise-ca.key',
  password: process.env.CA_PASSWORD, // If key is encrypted
})

// Generate certificates signed by enterprise CA
const cert = await generateCertificate({
  domain: 'app.localhost',
  rootCA: enterpriseCA,
})
```

### Certificate Signing Request (CSR)

Generate a CSR for external signing:

```ts
import { generateCSR } from '@stacksjs/tlsx'

const csr = await generateCSR({
  domain: 'app.example.com',
  organizationName: 'My Company',
  countryName: 'US',
})

// Send csr.request to your CA for signing
console.log(csr.request) // PEM-encoded CSR

// Import signed certificate
await importSignedCertificate({
  csr: csr,
  signedCert: '/path/to/signed.crt',
  outputPath: './certs/app.crt',
})
```

## CA Security

### Encrypted Private Keys

```ts
const ca = await createRootCA({
  commonName: 'My Secure CA',
  keyPath: './ca/root-ca.key',
  password: 'strong-password',
  cipher: 'aes-256-cbc',
})
```

### Hardware Security Module (HSM)

```ts
import { createRootCA } from '@stacksjs/tlsx'

const ca = await createRootCA({
  commonName: 'My HSM CA',
  keyStorage: {
    type: 'pkcs11',
    library: '/usr/lib/softhsm/libsofthsm2.so',
    slot: 0,
    pin: process.env.HSM_PIN,
  },
})
```

## CA Distribution

### Team Distribution

Share CA across your team:

```ts
// create-team-ca.ts
import { createRootCA, exportCA } from '@stacksjs/tlsx'

// Create CA
const ca = await createRootCA({
  commonName: 'Team Development CA',
  organizationName: 'My Team',
})

// Export public certificate only (safe to share)
await exportCA(ca, {
  publicOnly: true, // Don't include private key
  output: './shared/team-ca.crt',
})

// Instructions for team members
console.log(`
Team members should run:
  tlsx ca trust --cert ./shared/team-ca.crt
`)
```

### Docker/Container Distribution

```dockerfile
# Dockerfile
FROM node:20

# Copy CA certificate
COPY ./ca/team-ca.crt /usr/local/share/ca-certificates/

# Update trust store
RUN update-ca-certificates

# Your app...
```

### Kubernetes Secret

```yaml
# ca-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: tlsx-ca
type: Opaque
data:
  ca.crt: <base64-encoded-ca-certificate>
```

## CA Management

### CA Rotation

Rotate CAs before expiration:

```ts
import { rotateCA } from '@stacksjs/tlsx'

await rotateCA({
  currentCA: './ca/current-ca.crt',
  currentKey: './ca/current-ca.key',
  newCA: './ca/new-ca.crt',
  newKey: './ca/new-ca.key',

  // Options
  overlap: 30, // Days of overlap
  reissueCerts: true, // Re-sign existing certificates
  certDir: './certs/',
})
```

### CA Revocation

Revoke a compromised CA:

```ts
import { revokeCA, createCRL } from '@stacksjs/tlsx'

// Create Certificate Revocation List
await createCRL({
  ca: './ca/root-ca.crt',
  caKey: './ca/root-ca.key',
  revokedCerts: [
    { serial: '01', reason: 'keyCompromise' },
    { serial: '02', reason: 'superseded' },
  ],
  output: './ca/crl.pem',
})
```

### CA Backup

```ts
import { backupCA } from '@stacksjs/tlsx'

await backupCA({
  ca: './ca/root-ca.crt',
  caKey: './ca/root-ca.key',
  output: './backup/ca-backup.tar.gz',
  encrypt: true,
  password: process.env.BACKUP_PASSWORD,
})
```

## Multi-CA Setup

### Development Environments

```ts
// tlsx.config.ts
export default {
  cas: {
    development: {
      commonName: 'Dev CA',
      certPath: './ca/dev-ca.crt',
      keyPath: './ca/dev-ca.key',
    },
    staging: {
      commonName: 'Staging CA',
      certPath: './ca/staging-ca.crt',
      keyPath: './ca/staging-ca.key',
    },
    testing: {
      commonName: 'Test CA',
      certPath: './ca/test-ca.crt',
      keyPath: './ca/test-ca.key',
    },
  },
}
```

```ts
// Usage
import { generateCertificate, loadConfig } from '@stacksjs/tlsx'

const config = await loadConfig()
const env = process.env.NODE_ENV || 'development'
const ca = config.cas[env]

await generateCertificate({
  domain: 'app.localhost',
  rootCA: ca,
})
```

## CA Monitoring

### Certificate Inventory

```ts
import { listSignedCertificates } from '@stacksjs/tlsx'

const certs = await listSignedCertificates({
  ca: './ca/root-ca.crt',
})

console.table(
  certs.map((cert) => ({
    domain: cert.subject.CN,
    serial: cert.serialNumber,
    expires: cert.validTo,
    status: cert.isExpired ? 'Expired' : 'Valid',
  })),
)
```

### Expiration Alerts

```ts
import { monitorCA } from '@stacksjs/tlsx'

monitorCA({
  ca: './ca/root-ca.crt',
  alertDays: 90,
  onAlert: async (ca) => {
    console.log(`CA expires in ${ca.daysRemaining} days`)
    // Send notification
  },
})
```

## Best Practices

### CA Lifecycle

1. **Create**: Generate with long validity (10+ years)
2. **Secure**: Store private key securely
3. **Distribute**: Share public certificate only
4. **Monitor**: Track expiration
5. **Rotate**: Plan replacement before expiration
6. **Archive**: Keep for certificate validation

### Security Guidelines

- Keep root CA private key offline
- Use intermediate CAs for daily signing
- Encrypt private keys with strong passwords
- Implement key ceremony for sensitive CAs
- Regular security audits

### Documentation

- Document CA purpose and scope
- Record all issued certificates
- Maintain chain of custody
- Keep renewal procedures updated

## Next Steps

- [Performance](/advanced/performance) - Optimization strategies
- [CI/CD Integration](/advanced/ci-cd-integration) - Pipeline automation
- [Configuration](/advanced/configuration) - Full configuration reference
