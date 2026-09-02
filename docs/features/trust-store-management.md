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

tlsx installs the CA into two places, and both are additive: the distro-wide system store first (this is what a headless box such as a Raspberry Pi needs, since curl, Bun and system services read it), then every NSS database (`cert9.db`) it finds under your home directory for Firefox and Chromium.

The distro family is read from `/etc/os-release` (`ID`, then each `ID_LIKE` entry), so derivatives such as Raspberry Pi OS, Pop!_OS or Rocky resolve to their parent. When neither classifies the system, tlsx probes for the anchor directories below.

| Family | Detected ids | Anchor written | Update command |
|---|---|---|---|
| Debian | debian, ubuntu, raspbian, linuxmint, pop, kali, alpine, ... | `/usr/local/share/ca-certificates/<ca-name>.crt` | `update-ca-certificates` |
| RHEL | rhel, fedora, centos, rocky, almalinux, amzn, ... | `/etc/pki/ca-trust/source/anchors/<ca-name>.crt` | `update-ca-trust` |
| Arch | arch, manjaro, endeavouros, ... | `/etc/ca-certificates/trust-source/anchors/<ca-name>.crt` | `trust extract-compat` (best effort) |

`<ca-name>` is the CA's Common Name, lower-cased and slugged (`local-development-root-ca.crt`). The steps run with `sudo` only when the process is not already root; as root the anchor is written directly and the update command runs bare. `SUDO_PASSWORD` is honoured as everywhere else in tlsx.

Before touching anything, tlsx checks whether the CA is already trusted by looking for its SHA-256 fingerprint in the consolidated bundle (`/etc/ssl/certs/ca-certificates.crt` on Debian, `/etc/pki/tls/certs/ca-bundle.crt` on RHEL). A second `tlsx install` is therefore a no-op with no sudo prompt, and `update-ca-certificates` is never rerun for a CA that is already in the bundle.

```ts
import { addCertToSystemTrustStore, installCA, isCertTrusted } from '@stacksjs/tlsx'

const { report } = await installCA()
// report.stores, for example:
// [{ store: 'linux-system', location: '/usr/local/share/ca-certificates/local-development-root-ca.crt', status: 'installed' }]

await isCertTrusted('~/.stacks/ssl/stacks.localhost.ca.crt') // true once the bundle carries it

// Install an existing CA file and get the same per-store report back
const stores = await addCertToSystemTrustStore('/path/to/root-ca.crt')
```

**Firefox and Chromium (NSS)**:
```
Location: ~/.pki/nssdb/ or ~/.mozilla/firefox/<profile>/
Command: certutil
```

A missing NSS database is no longer a warning when the system store took the CA; the warning only appears when neither store could be updated.

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

## Handing the CA to Other Devices

A CA minted on one machine (a Pi running a gateway, say) has to be trusted by every laptop and phone that talks to it. `tlsx export-ca` writes the CA in the container each platform wants, and `tlsx trust-instructions` prints the exact steps.

```bash
# PEM for macOS / Linux (default)
tlsx export-ca --out ~/root-ca.pem

# DER for Windows
tlsx export-ca --format der --out root-ca.cer

# Apple configuration profile for iOS / iPadOS
tlsx export-ca --format mobileconfig --name "Pi Stacks Root CA" --out ~/Desktop/pi-root-ca.mobileconfig

# A different CA than the configured one
tlsx export-ca --ca /etc/rpx/ssl/root-ca.crt --format mobileconfig

# The steps for one platform, or all of them when --platform is omitted
tlsx trust-instructions --platform ios --ca ~/Desktop/pi-root-ca.mobileconfig
tlsx trust-instructions --platform macos
```

The `.mobileconfig` is an unsigned profile with a single `com.apple.security.root` payload. Its `PayloadUUID`s are derived from the CA's fingerprint, so re-exporting the same CA produces the same profile and iOS updates it in place instead of installing a duplicate. After installing the profile on iOS, full trust still has to be enabled under Settings > General > About > Certificate Trust Settings.

Options: `--format pem|der|mobileconfig`, `--out <file>`, `--name` (profile display name, defaults to the CA's Common Name), `--organization`, `--identifier` (reverse-DNS, defaults to `dev.stacksjs.tlsx.<fingerprint-prefix>`). Platforms for `trust-instructions`: `macos`, `ios`, `windows`, `debian`, `rhel`, `android`, `linux-nss`.

```ts
import { exportCA, trustInstructions } from '@stacksjs/tlsx'

const profile = await exportCA({ caCertPath: '/etc/rpx/ssl/root-ca.crt', format: 'mobileconfig', name: 'Pi Stacks Root CA' })
// profile.data (string), profile.filename ('pi-stacks-root-ca.mobileconfig'), profile.mime ('application/x-apple-aspen-config')

console.log(trustInstructions('ios', profile.filename))
```

`exportCA` returns the bytes plus a filename and MIME type, so a server can hand the profile out over HTTP as easily as writing it to disk.

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

# Output
# Name                    Type    Trusted    Expires
# example.localhost       Host    Yes        2025-01-01
# My Development CA       CA      Yes        2034-01-01
```

### Verify Trust

```bash
# CLI
tlsx verify example.localhost

# Output
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
