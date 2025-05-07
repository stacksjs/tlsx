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