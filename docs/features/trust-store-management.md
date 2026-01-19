# Trust Store Management

tlsx provides cross-platform system trust store integration, automatically adding certificates to your operating system's trust store so browsers accept them without warnings.

## Overview

Trust store management enables:

- **Automatic Trust**: Add certificates to system trust store
- **Cross-Platform**: Works on macOS, Linux, and Windows
- **Browser Support**: Eliminates SSL warnings in all browsers
- **Cleanup**: Remove certificates when no longer needed

## Adding Certificates to Trust Store

### Automatic (Default)

When generating certificates, tlsx automatically adds them to the trust store:

```bash
# Automatically trusts the certificate
tlsx secure example.localhost
```

```ts
// Library - automatically trusts by default
import { generateCertificate } from '@stacksjs/tlsx'

const cert = await generateCertificate({
  domain: 'example.localhost',
  // trust: true is the default
})
```

### Manual Trust

Add an existing certificate to the trust store:

```bash
# CLI
tlsx trust path/to/cert.crt
```

```ts
// Library
import { addCertToSystemTrustStore } from '@stacksjs/tlsx'

await addCertToSystemTrustStore({
  certPath: './my-cert.crt',
})
```

### Trust with Save

Generate, save, and trust in one operation:

```ts
import { addCertToSystemTrustStoreAndSaveCert } from '@stacksjs/tlsx'

const cert = await generateCertificate({
  domain: 'example.localhost',
})

await addCertToSystemTrustStoreAndSaveCert(cert, rootCA.certificate)
```

## Removing Certificates

### Remove Specific Certificate

```bash
# CLI
tlsx revoke example.localhost

# With custom certificate name
tlsx revoke example.localhost --cert-name "My Custom Cert"
```

```ts
// Library
import { removeCertFromSystemTrustStore } from '@stacksjs/tlsx'

await removeCertFromSystemTrustStore('example.localhost')

// With custom name
await removeCertFromSystemTrustStore('example.localhost', {}, 'My Custom Cert')
```

### Cleanup All tlsx Certificates

```bash
# CLI - Remove all tlsx certificates
tlsx cleanup

# With custom pattern
tlsx cleanup --pattern "My Custom Pattern"
```

```ts
// Library
import { cleanupTrustStore } from '@stacksjs/tlsx'

// Remove all tlsx certificates
await cleanupTrustStore()

// Remove matching pattern
await cleanupTrustStore({}, 'My Custom Pattern')
```

## Platform-Specific Behavior

### macOS

tlsx uses the Keychain Access system:

```
Location: System Keychain (/Library/Keychains/System.keychain)
Command: security add-trusted-cert
Requires: sudo/admin password
```

**Manual verification**:
1. Open "Keychain Access" app
2. Select "System" keychain
3. Search for your certificate name
4. Verify "Trust" settings show "Always Trust"

### Linux

tlsx supports multiple trust store mechanisms:

**Debian/Ubuntu**:
```
Location: /etc/ssl/certs/
Command: update-ca-certificates
```

**RHEL/CentOS/Fedora**:
```
Location: /etc/pki/ca-trust/source/anchors/
Command: update-ca-trust
```

**Firefox (NSS)**:
```
Location: ~/.pki/nssdb/ or /etc/pki/nssdb/
Command: certutil
```

### Windows

tlsx uses the Windows Certificate Manager:

```
Location: Local Machine\Trusted Root Certification Authorities
Command: certutil -addstore
Requires: Administrator
```

**Manual verification**:
1. Open "certmgr.msc"
2. Navigate to "Trusted Root Certification Authorities"
3. Find your certificate

## Browser-Specific Trust

### Chrome/Chromium

Chrome uses the system trust store on all platforms:

- **macOS**: Keychain Access
- **Linux**: NSS database
- **Windows**: Certificate Manager

### Firefox

Firefox maintains its own certificate store:

```bash
# Add to Firefox trust store
tlsx trust ./cert.crt --firefox

# Or manually
certutil -A -n "My Cert" -t "C,," -i cert.crt -d ~/.mozilla/firefox/*.default
```

### Safari

Safari uses macOS Keychain - automatically supported.

### Edge

Edge uses Windows Certificate Manager - automatically supported.

## Trust Store Operations

### List Trusted Certificates

```bash
# CLI
tlsx list --trusted

# Output:
# Name                    Type    Trusted    Expires
# example.localhost       Host    Yes        2025-01-01
# My Development CA       CA      Yes        2034-01-01
```

### Verify Trust

```bash
# CLI
tlsx verify example.localhost

# Output:
# Certificate: example.localhost
# Status: Trusted
# Chain: Valid
# Expires: 2025-01-01
```

```ts
// Library
import { verifyCertificateTrust } from '@stacksjs/tlsx'

const result = await verifyCertificateTrust('example.localhost')
console.log(result)
// {
//   trusted: true,
//   chain: 'valid',
//   expires: '2025-01-01',
// }
```

### Export Trusted Certificates

```bash
# Export all trusted certificates
tlsx export --output ./certs/

# Export specific certificate
tlsx export example.localhost --output ./my-cert.crt
```

## Configuration

### Trust Store Settings

```ts
// tlsx.config.ts
export default {
  trust: {
    autoTrust: true, // Automatically trust generated certs
    stores: ['system', 'firefox'], // Target trust stores
    requireAdmin: true, // Require elevated privileges
  },
}
```

### Skip Trust Store

Generate certificates without adding to trust store:

```bash
# CLI
tlsx secure example.localhost --no-trust
```

```ts
// Library
const cert = await generateCertificate({
  domain: 'example.localhost',
  trust: false,
})
```

## Troubleshooting

### Permission Denied

Trust store operations require elevated privileges:

```bash
# macOS/Linux
sudo tlsx secure example.localhost

# Windows (run as Administrator)
tlsx secure example.localhost
```

### Browser Still Shows Warning

1. **Restart browser** after adding certificate
2. **Clear browser cache** and SSL state
3. **Verify certificate is trusted**:
   ```bash
   tlsx verify example.localhost
   ```

### Firefox Not Trusting Certificate

Firefox has its own trust store. Add explicitly:

```bash
tlsx trust ./cert.crt --firefox
```

Or manually import in Firefox:
1. Settings → Privacy & Security → Certificates
2. View Certificates → Authorities → Import

### Certificate Chain Invalid

Ensure the CA certificate is also trusted:

```bash
# Trust CA first
tlsx ca trust --cert ~/.stacks/ssl/ca.crt

# Then trust host certificate
tlsx trust ~/.stacks/ssl/example.localhost.crt
```

## Security Considerations

### Development Only

- Only trust certificates on development machines
- Never add development CAs to production systems
- Remove trusted certificates when no longer needed

### Minimal Trust

- Trust only necessary certificates
- Use short validity periods
- Clean up regularly with `tlsx cleanup`

### Audit Trail

```bash
# List all tlsx certificates
tlsx list --all

# Export for audit
tlsx list --json > certificate-audit.json
```

## Next Steps

- [Advanced Configuration](/advanced/configuration) - Full configuration options
- [Custom CAs](/advanced/custom-cas) - Advanced CA management
- [CI/CD Integration](/advanced/ci-cd-integration) - Automation in pipelines
