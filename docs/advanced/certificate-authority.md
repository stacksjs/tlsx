# Certificate Authority

`tlsx` allows you to create and manage your own Certificate Authority (CA) for signing local development certificates.

## What is a Certificate Authority?

A Certificate Authority (CA) is an entity that issues digital certificates. Each certificate verifies the ownership of a public key by the named subject of the certificate. In the context of `tlsx`, a local CA is created to sign certificates for your development domains, enabling them to be trusted by your system.

## Creating a Root CA

`tlsx` can create a root CA certificate that will be used to sign all your development certificates:

```ts
import { createRootCA } from '@stacksjs/tlsx'

const rootCA = await createRootCA({
  commonName: 'My Local Development CA',
  organization: 'My Organization',
  organizationalUnit: 'Development Team',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  validityYears: 10,
  keySize: 4096,
})
```

The created root CA includes:

- A certificate (public key + identity information)
- A private key for signing other certificates

## Using a Custom CA

You can use your custom CA to sign certificates for your domains:

```ts
import { generateCertificate } from '@stacksjs/tlsx'

const cert = await generateCertificate({
  domain: 'example.local',
  rootCA: myCustomCA, // Use your custom CA
})
```

## CA Storage and Management

`tlsx` stores your CA certificate and private key securely:

```ts
import { storeCACertificate } from '@stacksjs/tlsx'

const caCertPath = storeCACertificate(rootCA.certificate, {
  basePath: '/custom/path',
  caCertPath: 'my-custom-ca.crt',
})
```

## System Trust Integration

For your certificates to be trusted, the CA must be added to your system's trust store:

```ts
import { addCertToSystemTrustStoreAndSaveCert } from '@stacksjs/tlsx'

await addCertToSystemTrustStoreAndSaveCert(cert, rootCA.certificate, {
  verbose: true,
})
```

## Security Considerations

- **Private Key Security**: Keep your CA private key secure. Anyone with access to it can issue certificates that your system will trust.
- **Development Use Only**: CA certificates created with `tlsx` are intended for development purposes only and should never be used in production.
- **Validity Period**: Consider the validity period of your CA certificate. A longer period means less frequent renewal but potentially higher risk if compromised.

## Advanced CA Configuration

For advanced use cases, you can customize your CA with specific extensions:

```ts
const rootCA = await createRootCA({
  // ... basic options
  extraAttributes: [
    { shortName: 'OU', value: 'Security Team' },
    { shortName: 'E', value: 'admin@example.com' },
  ],
})
```

## Related Topics

- [Custom Certificates](/advanced/custom-certificates)
- [Key Usage & Extensions](/advanced/key-usage-extensions)
