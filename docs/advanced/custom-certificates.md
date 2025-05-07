# Custom Certificates

`tlsx` provides powerful options for creating custom certificates tailored to your specific needs.

## Certificate Customization Options

When generating certificates with `tlsx`, you can customize various aspects:

### Basic Certificate Properties

- **Domain Names**: Primary domain and additional domains
- **Validity Period**: How long the certificate will be valid
- **Serial Number**: Custom or automatically generated

### Certificate Subject Information

- **Common Name (CN)**: Typically your primary domain
- **Organization (O)**: Your company or project name
- **Organizational Unit (OU)**: Department or team
- **Country (C)**: Two-letter country code
- **State/Province (ST)**: Your state or province
- **Locality (L)**: Your city or locality

### Advanced Properties

- **Key Size**: Strength of the certificate key
- **Subject Alternative Names (SANs)**: Additional identities
- **Key Usage**: Specific constraints on key usage
- **Extended Key Usage**: Additional usage constraints

## Example: Creating a Fully Customized Certificate

Using the library:

```ts
import { generateCertificate } from '@stacksjs/tlsx'

const cert = await generateCertificate({
  domain: 'primary.example.local',
  domains: ['api.example.local', 'admin.example.local'],
  rootCA: existingCA,

  // Certificate validity
  validityDays: 730,  // 2 years

  // Certificate subject details
  commonName: 'Example Project Local',
  organizationName: 'My Company, Inc.',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',

  // Advanced options
  altNameIPs: ['127.0.0.1', '192.168.1.100'],
  altNameURIs: ['localhost'],

  // Key usage extensions
  keyUsage: {
    digitalSignature: true,
    keyEncipherment: true,
  },

  extKeyUsage: {
    serverAuth: true,
    clientAuth: true,
  },
})
```

Using the CLI with a configuration file:

```ts
// tls.config.ts
export default {
  domain: 'primary.example.local',
  domains: ['api.example.local', 'admin.example.local'],
  validityDays: 730,
  organizationName: 'My Company, Inc.',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  altNameIPs: ['127.0.0.1', '192.168.1.100'],
}
```

## Storage Options

You can also customize where and how certificates are stored:

```ts
import { storeCertificate } from '@stacksjs/tlsx'

const certPath = storeCertificate(cert, {
  basePath: '/custom/path/to/certs',
  certPath: 'my-custom-cert.crt',
  keyPath: 'my-custom-key.key',
})
```

## Related Topics

- [Certificate Authority](/advanced/certificate-authority)
- [Key Usage & Extensions](/advanced/key-usage-extensions)
