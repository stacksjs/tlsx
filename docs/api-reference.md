# API Reference

This page provides detailed documentation for the `tlsx` API.

## Core Functions

### generateCertificate

Generates a certificate for one or multiple domains.

```ts
async function generateCertificate(options: CertificateOptions): Promise<Certificate>
```

**Parameters:**

- `options`: Configuration options for the certificate generation
  - `domain`: Primary domain for the certificate
  - `domains`: Array of additional domains
  - `rootCA`: Root CA certificate and private key
  - `validityDays`: Number of days the certificate is valid
  - `countryName`: Two-letter country code
  - `stateName`: State or province name
  - `localityName`: City or locality name
  - `organizationName`: Organization name
  - `commonName`: Common name for the certificate
  - `altNameIPs`: Array of IP addresses to include as SANs
  - `altNameURIs`: Array of URIs to include as SANs
  - `subjectAltNames`: Array of custom SANs
  - `basicConstraints`: Basic constraints extension
  - `keyUsage`: Key usage extension
  - `extKeyUsage`: Extended key usage extension
  - `verbose`: Enable verbose logging

**Returns:**

- `Certificate`: Object containing certificate, private key, and validity dates

**Example:**

```ts
const cert = await generateCertificate({
  domain: 'example.local',
  domains: ['api.example.local'],
  rootCA: existingCA,
  validityDays: 365,
})
```

### createRootCA

Creates a new Certificate Authority (CA) certificate.

```ts
async function createRootCA(options?: CAOptions): Promise<Certificate>
```

**Parameters:**

- `options`: Configuration options for the CA certificate generation
  - `keySize`: RSA key size (default: 2048)
  - `validityYears`: Number of years the CA is valid (default: 10)
  - `countryName`: Two-letter country code
  - `stateName`: State or province name
  - `localityName`: City or locality name
  - `organization`: Organization name
  - `organizationalUnit`: Organizational unit name
  - `commonName`: Common name for the CA
  - `extraAttributes`: Additional subject attributes
  - `verbose`: Enable verbose logging

**Returns:**

- `Certificate`: Object containing CA certificate, private key, and validity dates

**Example:**

```ts
const rootCA = await createRootCA({
  commonName: 'Local Development Root CA',
  organization: 'My Organization',
  validityYears: 10,
})
```

### addCertToSystemTrustStoreAndSaveCert

Adds a certificate to the system trust store and saves it to a file.

```ts
async function addCertToSystemTrustStoreAndSaveCert(
  cert: Cert,
  caCert: string,
  options?: TlsOption
): Promise<CertPath>
```

**Parameters:**

- `cert`: Certificate and private key
- `caCert`: CA certificate
- `options`: Configuration options
  - `basePath`: Base path for storing certificates
  - `certPath`: Path for the certificate file
  - `keyPath`: Path for the private key file
  - `caCertPath`: Path for the CA certificate file
  - `verbose`: Enable verbose logging

**Returns:**

- `CertPath`: Path to the stored certificate

**Example:**

```ts
const certPath = await addCertToSystemTrustStoreAndSaveCert(
  cert,
  rootCA.certificate,
  { verbose: true }
)
```

### installCA

Installs the local Root CA into the system trust store, mkcert style. Generates
the CA on first run, then installs only the CA certificate, so every host
certificate signed by it is trusted without another prompt. Idempotent: an
already-trusted CA is detected by fingerprint and skipped.

```ts
async function installCA(options?: InstallCAOptions): Promise<InstallCAResult>
```

**Returns:**

- `caCertPath`, `caKeyPath`: where the CA lives on disk
- `generated`: true when this call minted a fresh CA
- `trustInstalled`: true when this call wrote to a trust store
- `alreadyTrusted`: true when the CA was trusted before the call
- `report`: per-store outcome, so a system-store install can be told from an NSS one

**Example:**

```ts
const { report } = await installCA()
// report.stores, on a Raspberry Pi:
// [{ store: 'linux-system', location: '/usr/local/share/ca-certificates/local-development-root-ca.crt', status: 'installed' }]
```

`report.trusted` is true when at least one store now holds the CA. On Linux the
system store and the NSS databases are independent: a missing browser profile
no longer discards a successful system install, and neither does a `certutil`
failure.

### isCertTrusted

Whether a CA is already trusted by this platform's system store.

```ts
async function isCertTrusted(caCertPemOrPath: string, options?: TrustStoreOptions): Promise<boolean>
```

macOS reads the keychain's SHA-256 hashes. Linux searches the distribution's
consolidated PEM bundle for the fingerprint, with no `openssl` and no
subprocess. Windows always answers false, because there is no cheap lookup, so
callers fall through to `certutil`. Ask this before generating certificates in
a loop, rather than rerunning the distribution's update command each time.

### installCAIntoLinuxSystemStore

The Linux half of `installCA`, exported on its own: copy the CA into the
distribution's anchor directory and regenerate the bundle.

```ts
async function installCAIntoLinuxSystemStore(
  caCertPath: string,
  options?: LinuxSystemTrustOptions
): Promise<LinuxSystemTrustResult>
```

The family is detected from `/etc/os-release` (`ID`, then each `ID_LIKE`
entry), falling back to probing for the anchor directories. It never throws for
a store problem: the outcome is in `status` (`installed`, `already-trusted`,
`unsupported`, `failed`) with `error` and the exact `commands` that ran, so the
caller decides whether an unrecognised distribution is fatal. `removeCAFromLinuxSystemStore(name, options?)` is the inverse.

### exportCA

Exports a CA certificate as PEM, DER, or an Apple configuration profile.

```ts
async function exportCA(options: ExportCAOptions): Promise<ExportedCA>
```

**Parameters:**

- `caCertPath`: path to the CA certificate, or the PEM itself
- `format`: `'pem' | 'der' | 'mobileconfig'`
- `name`, `organization`, `identifier`: profile metadata, each defaulting from the CA's own subject or fingerprint

**Returns:**

- `data`: text for PEM and profiles, bytes for DER
- `filename`: a suggested name with the conventional extension
- `mime`: the content type, so the result can be served straight from an HTTP handler

The profile's `PayloadUUID`s are derived from the CA fingerprint, so exporting
the same authority twice yields a byte-identical profile.

### trustInstructions

The exact steps to trust a CA on a given platform, as text.

```ts
function trustInstructions(platform: TrustPlatform, caPath: string): string
```

`TrustPlatform` is one of `macos`, `ios`, `windows`, `debian`, `rhel`,
`android`, `linux-nss`. The iOS text includes the step that is easy to miss:
after installing the profile, full trust has to be enabled under Settings,
General, About, Certificate Trust Settings.

### storeCertificate

Stores a certificate and private key to the filesystem.

```ts
function storeCertificate(cert: Cert, options?: TlsOption): CertPath
```

**Parameters:**

- `cert`: Certificate and private key
- `options`: Configuration options
  - `basePath`: Base path for storing certificates
  - `certPath`: Path for the certificate file
  - `keyPath`: Path for the private key file
  - `verbose`: Enable verbose logging

**Returns:**

- `CertPath`: Path to the stored certificate

**Example:**

```ts
const certPath = storeCertificate(cert, {
  basePath: '/custom/path',
  certPath: 'my-cert.crt',
  keyPath: 'my-key.key',
})
```

### storeCACertificate

Stores a CA certificate to the filesystem.

```ts
function storeCACertificate(caCert: string, options?: TlsOption): CertPath
```

**Parameters:**

- `caCert`: CA certificate
- `options`: Configuration options
  - `basePath`: Base path for storing certificates
  - `caCertPath`: Path for the CA certificate file
  - `verbose`: Enable verbose logging

**Returns:**

- `CertPath`: Path to the stored CA certificate

**Example:**

```ts
const caCertPath = storeCACertificate(rootCA.certificate, {
  basePath: '/custom/path',
  caCertPath: 'my-ca.crt',
})
```

## Utility Functions

### generateRandomSerial

Generates a random serial number for a certificate.

```ts
function generateRandomSerial(verbose?: boolean): RandomSerialNumber
```

**Parameters:**

- `verbose`: Enable verbose logging

**Returns:**

- `RandomSerialNumber`: A random serial number

**Example:**

```ts
const serialNumber = generateRandomSerial()
```

### calculateValidityDates

Calculates the validity dates for a certificate.

```ts
function calculateValidityDates(options: {
  validityDays?: number
  validityYears?: number
  notBeforeDays?: number
  verbose?: boolean
}): { notBefore: Date, notAfter: Date }
```

**Parameters:**

- `options`: Configuration options
  - `validityDays`: Number of days the certificate is valid
  - `validityYears`: Number of years the certificate is valid
  - `notBeforeDays`: Number of days before the current date to start validity
  - `verbose`: Enable verbose logging

**Returns:**

- Object containing `notBefore` and `notAfter` dates

**Example:**

```ts
const { notBefore, notAfter } = calculateValidityDates({
  validityDays: 365,
  notBeforeDays: 1,
})
```

## Types

### Certificate

```ts
interface Certificate {
  certificate: string
  privateKey: string
  notBefore: Date
  notAfter: Date
}
```

### CertificateOptions

```ts
interface CertificateOptions {
  domain?: string
  domains?: string[]
  rootCA: {
    certificate: string
    privateKey: string
  }
  validityDays?: number
  countryName?: string
  stateName?: string
  localityName?: string
  organizationName?: string
  commonName?: string
  certificateAttributes?: Array<{
    shortName: string
    value: string
  }>
  basicConstraints?: {
    cA?: boolean
    critical?: boolean
  }
  keyUsage?: {
    digitalSignature?: boolean
    nonRepudiation?: boolean
    keyEncipherment?: boolean
    dataEncipherment?: boolean
    keyAgreement?: boolean
    keyCertSign?: boolean
    cRLSign?: boolean
    encipherOnly?: boolean
    decipherOnly?: boolean
    critical?: boolean
  }
  extKeyUsage?: {
    serverAuth?: boolean
    clientAuth?: boolean
    codeSigning?: boolean
    emailProtection?: boolean
    timeStamping?: boolean
    critical?: boolean
  }
  altNameIPs?: string[]
  altNameURIs?: string[]
  subjectAltNames?: SubjectAltName[]
  isCA?: boolean
  verbose?: boolean
}
```

### CAOptions

```ts
interface CAOptions {
  keySize?: number
  validityYears?: number
  countryName?: string
  stateName?: string
  localityName?: string
  organization?: string
  organizationalUnit?: string
  commonName?: string
  extraAttributes?: Array<{
    shortName: string
    value: string
  }>
  verbose?: boolean
}
```

### TlsOption

```ts
interface TlsOption {
  basePath?: string
  certPath?: string
  keyPath?: string
  caCertPath?: string
  verbose?: boolean
}
```

## Constants and Config

### config

Default configuration values used by `tlsx`.

```ts
const config: {
  basePath: string
  caCertPath: string
  certPath: string
  keyPath: string
  domain: string
  hostCertCN: string
  commonName: string
  countryName: string
  stateName: string
  localityName: string
  organizationName: string
  validityDays: number
  altNameIPs: string[]
  altNameURIs: string[]
}
```

## Related Topics

- [Custom Certificates](/advanced/custom-certificates)
- [Certificate Authority](/advanced/certificate-authority)
- [Key Usage & Extensions](/advanced/key-usage-extensions)
