# System Trust Store Integration

`tlsx` integrates with your operating system's trust store to ensure that your locally generated certificates are trusted by all applications on your system.

## What is a System Trust Store?

A trust store (or certificate store) is a database of trusted certificates used by the operating system and applications to verify the identity of secure connections. When you generate a self-signed certificate, it isn't automatically trusted by your system until it's added to this trust store.

## Cross-platform Support

`tlsx` provides cross-platform support for trust store integration:

- **macOS**: Integrates with the macOS Keychain
- **Windows**: Adds certificates to the Windows Certificate Store
- **Linux**: Supports various certificate databases including those used by Firefox and Chrome

## Benefits of Trust Store Integration

- **No Security Warnings**: Browsers won't show security warnings for your local sites
- **Automatic Trust**: All applications on your system will trust your development certificates
- **Seamless Development**: Test secure features without worrying about certificate warnings
- **Consistent Experience**: Same behavior across browsers and applications

## How tlsx Handles Trust Store Integration

When you generate a certificate with `tlsx`, it:

1. Creates a local Certificate Authority (CA) if one doesn't exist
2. Adds this CA to your system's trust store (may require elevated permissions)
3. Signs your domain certificates with this trusted CA
4. Stores certificates in a consistent location for easy access

## Example Usage

```ts
import { addCertToSystemTrustStoreAndSaveCert } from '@stacksjs/tlsx'

// Add the certificate to the system trust store
await addCertToSystemTrustStoreAndSaveCert(cert, rootCA.certificate)
```

Using the CLI, this happens automatically when you generate a certificate:

```bash
tlsx secure example.local
```

## Security Considerations

- The local CA is only for development purposes and should never be used in production
- Trust store modifications require administrative privileges on most systems
- `tlsx` makes it clear which certificates are for development use only

## Related Features

- [SSL Support](/features/ssl-support)
- [Zero-Config](/features/zero-config)
