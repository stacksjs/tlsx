# Key Usage & Extensions

`tlsx` provides advanced options for configuring certificate key usage and extensions, allowing you to create certificates with specific capabilities and constraints.

## Certificate Extensions

Certificate extensions are additional fields in an X.509 certificate that provide information about how the certificate can be used. They're crucial for defining the certificate's purpose, constraints, and capabilities.

## Basic Constraints

Basic constraints define whether a certificate can act as a Certificate Authority (CA):

```ts
import { generateCertificate } from '@stacksjs/tlsx'

const cert = await generateCertificate({
  domain: 'example.local',
  rootCA: existingCA,

  // Basic constraints
  basicConstraints: {
    cA: false,      // Not a CA certificate
    critical: true, // This extension is critical
  },
})
```

## Key Usage

Key usage extensions define the purpose of the public key in the certificate:

```ts
const cert = await generateCertificate({
  domain: 'example.local',
  rootCA: existingCA,

  // Key usage
  keyUsage: {
    digitalSignature: true,  // Allow digital signatures
    keyEncipherment: true,   // Allow key encipherment
    dataEncipherment: false, // Disallow data encipherment
    critical: true,          // This extension is critical
  },
})
```

Common key usage flags:

- `digitalSignature`: For authentication and signing operations
- `keyEncipherment`: For encrypting keys
- `dataEncipherment`: For encrypting user data
- `keyAgreement`: For key agreement algorithms
- `keyCertSign`: For signing certificates (CA certificates)
- `cRLSign`: For signing certificate revocation lists

## Extended Key Usage

Extended key usage provides additional information about the purpose of a certificate:

```ts
const cert = await generateCertificate({
  domain: 'example.local',
  rootCA: existingCA,

  // Extended key usage
  extKeyUsage: {
    serverAuth: true,  // Web server authentication
    clientAuth: true,  // Web client authentication
    codeSigning: false,
    emailProtection: false,
    timeStamping: false,
    critical: false,    // This extension is not critical
  },
})
```

Common extended key usage purposes:

- `serverAuth`: TLS web server authentication
- `clientAuth`: TLS web client authentication
- `codeSigning`: Code signing
- `emailProtection`: Email protection (S/MIME)
- `timeStamping`: Timestamping

## Subject Alternative Names (SANs)

Subject Alternative Names specify additional identities for the certificate:

```ts
const cert = await generateCertificate({
  domain: 'example.local',

  // Built-in SAN support
  domains: ['api.example.local', 'admin.example.local'],
  altNameIPs: ['127.0.0.1', '192.168.1.100'],
  altNameURIs: ['localhost'],

  // Custom SANs
  subjectAltNames: [
    { type: 2, value: 'custom.example.local' }, // DNS name
    { type: 7, value: '10.0.0.1' },             // IP address
    { type: 6, value: 'https://example.local' }, // URI
  ],

  rootCA: existingCA,
})
```

SAN types:

- Type 2: DNS name
- Type 7: IP address
- Type 6: URI
- Type 1: Email address
- Type 8: OID (Object Identifier)

## Critical vs. Non-Critical Extensions

When an extension is marked as `critical: true`, it means that systems must understand and process this extension to use the certificate. If a system doesn't understand a critical extension, it must reject the certificate.

Non-critical extensions (`critical: false`) can be safely ignored by systems that don't understand them.

## Complete Example

```ts
const cert = await generateCertificate({
  domain: 'example.local',
  domains: ['api.example.local', 'admin.example.local'],
  rootCA: existingCA,

  // Basic constraints
  basicConstraints: {
    cA: false,
    critical: true,
  },

  // Key usage
  keyUsage: {
    digitalSignature: true,
    keyEncipherment: true,
    critical: true,
  },

  // Extended key usage
  extKeyUsage: {
    serverAuth: true,
    clientAuth: true,
  },

  // Alternative names
  altNameIPs: ['127.0.0.1'],
  altNameURIs: ['localhost'],
})
```

## Related Topics

- [Custom Certificates](/advanced/custom-certificates)
- [Certificate Authority](/advanced/certificate-authority)