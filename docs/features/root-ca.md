# Root CA

tlsx manages Root Certificate Authorities (CAs) that sign your development certificates, enabling trusted HTTPS without browser warnings.

## Overview

A Root CA in tlsx:

- **Signs Host Certificates**: Creates a chain of trust
- **System Trust**: Can be added to your OS trust store
- **Multi-Certificate**: Signs multiple host certificates with one CA
- **Cross-Platform**: Works on macOS, Linux, and Windows

## How It Works

```
Root CA (trusted by your system)
        │
        │ signs
        ▼
Host Certificate (for your domain)
        │
        │ secures
        ▼
Your Development Server
```

## Creating a Root CA

### Automatic Creation

When you generate a certificate, tlsx automatically creates a Root CA if one doesn't exist:

```bash
tlsx secure example.localhost
```

This creates:
- `~/.stacks/ssl/example.localhost.ca.crt` - Root CA certificate
- `~/.stacks/ssl/example.localhost.ca.key` - Root CA private key

### Manual Creation

Create a Root CA explicitly:

```bash
# CLI
tlsx ca create --name "My Development CA"
```

```ts
// Library
import { createRootCA } from '@stacksjs/tlsx'

const ca = await createRootCA({
  commonName: 'My Development CA',
  organizationName: 'My Company',
  countryName: 'US',
  validityDays: 3650, // 10 years
})

console.log(ca.certificate) // PEM-encoded CA certificate
console.log(ca.privateKey) // PEM-encoded CA private key
```

## CA Configuration

### Full Configuration

```ts
const ca = await createRootCA({
  // Identity
  commonName: 'My Development CA',
  organizationName: 'My Company',
  organizationalUnitName: 'Development',
  countryName: 'US',
  stateName: 'California',
  localityName: 'San Francisco',

  // Validity
  validityDays: 3650, // 10 years

  // Key settings
  keySize: 4096,

  // Output paths
  certPath: '~/.ssl/my-ca.crt',
  keyPath: '~/.ssl/my-ca.key',
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `commonName` | string | `'tlsx CA'` | CA certificate name |
| `organizationName` | string | `'stacksjs.org'` | Organization name |
| `countryName` | string | `'US'` | Country code (2 letters) |
| `validityDays` | number | `3650` | Validity in days |
| `keySize` | number | `2048` | RSA key size |

## Using a Root CA

### Sign Multiple Certificates

Use one CA to sign multiple host certificates:

```ts
import { createRootCA, generateCertificate } from '@stacksjs/tlsx'

// Create CA once
const ca = await createRootCA({
  commonName: 'My Dev CA',
})

// Sign multiple certificates
const frontendCert = await generateCertificate({
  domain: 'app.localhost',
  rootCA: ca,
})

const apiCert = await generateCertificate({
  domain: 'api.localhost',
  rootCA: ca,
})

const adminCert = await generateCertificate({
  domain: 'admin.localhost',
  rootCA: ca,
})
```

### Load Existing CA

```ts
import { loadRootCA, generateCertificate } from '@stacksjs/tlsx'

// Load existing CA
const ca = await loadRootCA({
  certPath: '~/.stacks/ssl/my-ca.crt',
  keyPath: '~/.stacks/ssl/my-ca.key',
})

// Use it to sign new certificates
const cert = await generateCertificate({
  domain: 'new-app.localhost',
  rootCA: ca,
})
```

## CA Trust

### Add CA to System Trust Store

```bash
# CLI
tlsx ca trust

# Or specify CA path
tlsx ca trust --cert ~/.stacks/ssl/my-ca.crt
```

```ts
// Library
import { trustRootCA } from '@stacksjs/tlsx'

await trustRootCA({
  certPath: '~/.stacks/ssl/my-ca.crt',
})
```

### Remove CA from Trust Store

```bash
# CLI
tlsx ca untrust

# Or by name
tlsx ca untrust --name "My Development CA"
```

```ts
// Library
import { untrustRootCA } from '@stacksjs/tlsx'

await untrustRootCA({
  commonName: 'My Development CA',
})
```

### Platform-Specific Trust

| Platform | Trust Store Location |
|----------|---------------------|
| macOS | Keychain Access (System) |
| Linux | `/etc/ssl/certs/` or NSS database |
| Windows | Certificate Manager (Local Machine) |

## CA Management

### List CAs

```bash
# CLI
tlsx ca list

# Output:
# Name                    Created       Status
# My Development CA       2024-01-01    Trusted
# Old CA                  2023-01-01    Not Trusted
```

```ts
// Library
import { listRootCAs } from '@stacksjs/tlsx'

const cas = await listRootCAs()
cas.forEach((ca) => {
  console.log(`${ca.name}: ${ca.trusted ? 'Trusted' : 'Not Trusted'}`)
})
```

### CA Information

```bash
# CLI
tlsx ca info ~/.stacks/ssl/my-ca.crt

# Output:
# Subject:     CN=My Development CA, O=My Company
# Issuer:      CN=My Development CA, O=My Company
# Valid From:  2024-01-01
# Valid To:    2034-01-01
# Key Size:    2048 bits
# Fingerprint: SHA256:abc123...
```

### Delete CA

```bash
# CLI
tlsx ca delete --name "Old CA"
```

```ts
// Library
import { deleteRootCA } from '@stacksjs/tlsx'

await deleteRootCA({
  certPath: '~/.stacks/ssl/old-ca.crt',
  keyPath: '~/.stacks/ssl/old-ca.key',
  untrust: true, // Also remove from trust store
})
```

## Shared CA Setup

### Team-Wide CA

Share a CA across your development team:

1. **Create CA**:
   ```bash
   tlsx ca create --name "Team Dev CA" --output ./team-ca
   ```

2. **Distribute** (securely share `team-ca.crt` only, not the private key)

3. **Team members trust the CA**:
   ```bash
   tlsx ca trust --cert ./team-ca.crt
   ```

4. **Generate individual certificates** (requires private key):
   ```bash
   tlsx secure app.localhost --ca-cert ./team-ca.crt --ca-key ./team-ca.key
   ```

### CI/CD CA

Use a dedicated CA for CI/CD environments:

```yaml
# .github/workflows/test.yml
- name: Setup CA
  run: |
    # Create CI-specific CA
    tlsx ca create --name "CI CA" --output ./ci-ca
    tlsx ca trust --cert ./ci-ca.crt

- name: Generate certificates
  run: |
    tlsx secure app.localhost \
      --ca-cert ./ci-ca.crt \
      --ca-key ./ci-ca.key
```

## Security Best Practices

### Private Key Protection

- **Never share** the CA private key
- Store in secure locations only
- Use file permissions: `chmod 600 ca.key`

### CA Separation

- Use different CAs for different environments
- Development CA separate from staging/production
- Rotate CAs periodically

### Validity Period

- CA validity: 10 years (development)
- Host certificates: 1 year or less
- Consider shorter periods for sensitive environments

## Troubleshooting

### CA Not Trusted

1. Verify CA is in system trust store
2. Restart browser after trusting CA
3. Check CA hasn't expired

### Certificate Chain Invalid

1. Verify certificate was signed by the correct CA
2. Check CA certificate path in configuration
3. Regenerate certificate with correct CA

### Permission Denied

1. Run with elevated privileges for trust store operations
2. Check file permissions on CA files
3. Verify user has access to certificate directories

## Next Steps

- [Trust Store Management](/features/trust-store-management) - System trust integration
- [Custom CAs](/advanced/custom-cas) - Advanced CA configuration
- [Configuration](/advanced/configuration) - Full configuration reference
