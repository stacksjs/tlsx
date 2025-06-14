<p align="center"><img src=".github/art/cover.jpg" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# tlsx

> A TLS library with automation. HTTPS by default through a light-weight library and/or CLI. Similar to mkcert.

## Features

- 🔒 SSL Support _(HTTPS by default)_
- 0️⃣ Zero-Config & Zero-Setup HTTPS
- 🛠️ Configurable Library & CLI
- 🔀 Multi-domain Support
- 🏗️ Cross-platform System Trust Store Integration

## Install

```bash
bun install -d @stacksjs/tlsx

# or, invoke immediately
bunx @stacksjs/tlsx
npx @stacksjs/tlsx
```

Please note, we are looking to publish this package to npm under the name `tlsx`.

_Here's to hoping npm will release the name for us 🙏🏽_

<!-- _Alternatively, you can install:_

```bash
brew install tlsx # wip
pkgx install tlsx # wip
``` -->

## Get Started

There are two ways of using this reverse proxy: _as a library or as a CLI._

### Library

Given the npm package is installed:

```ts
import type { AddCertOptions, CAOptions, CertificateOptions, TlsConfig, TlsOptions } from '@stacksjs/tlsx'
import { addCertToSystemTrustStoreAndSaveCert, cleanupTrustStore, config, forge, generateCertificate, pki, removeCertFromSystemTrustStore, storeCertificate, tls } from '@stacksjs/tlsx'

// Generate a certificate for a single domain
const cert = await generateCertificate({
  domain: 'example.com',
  rootCA: existingCA,
  validityDays: 365,
})

// Generate a certificate for multiple domains
const multiDomainCert = await generateCertificate({
  domains: ['example.com', 'api.example.com', '*.example.com'],
  rootCA: existingCA,
  validityDays: 365,
})

// Generate a certificate with both primary domain and additional domains
const combinedCert = await generateCertificate({
  domain: 'example.com',
  domains: ['api.example.com', '*.example.com'],
  rootCA: existingCA,
  validityDays: 365,
})

// Store and trust the certificate
await addCertToSystemTrustStoreAndSaveCert(cert, rootCA.certificate)

// Remove a specific certificate
await removeCertFromSystemTrustStore('example.com')

// Remove a certificate with a specific name
await removeCertFromSystemTrustStore('example.com', {}, 'My Custom Certificate Name')

// Clean up all TLSX certificates from the system trust store
await cleanupTrustStore()

// Clean up certificates matching a specific pattern
await cleanupTrustStore({}, 'My Custom Pattern')
```

### CLI

```bash
# Generate certificate for a single domain
tlsx secure example.com

# Generate certificate for multiple domains
tlsx secure -d "example.com,api.example.com,*.example.com"

# Generate certificate with primary domain and additional domains
tlsx secure example.com -d "api.example.com,*.example.com"

# Generate certificate with custom validity and organization
tlsx secure example.com --validity-days 365 --organization-name "My Company"

# Revoke a certificate for a domain
tlsx revoke example.com

# Revoke a certificate with a specific name
tlsx revoke example.com --cert-name "My Custom Certificate"

# Clean up all TLSX certificates from the system trust store
tlsx cleanup

# Clean up certificates matching a specific pattern
tlsx cleanup --pattern "My Custom Pattern"

# List all certificates
tlsx list

# Verify a certificate
tlsx verify path/to/cert.crt

# Show system configuration and paths
tlsx info

# Show all available options
tlsx secure --help

# Show version
tlsx version
```

## Configuration

`tlsx` can be configured using a `tls.config.ts` _(or `tls.config.js`)_ file and it will be automatically loaded when running the `tlsx` command.

```ts
// tlsx.config.{ts,js}
import type { TlsConfig } from '@stacksjs/tlsx'

export default {
  domain: 'stacks.localhost',
  hostCertCN: 'stacks.localhost',
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.ca.crt`),
  certPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt`),
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt.key`),
  altNameIPs: ['127.0.0.1'],
  altNameURIs: ['localhost'],
  organizationName: 'stacksjs.org',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  commonName: 'stacks.localhost',
  validityDays: 180,
  verbose: false,
} satisfies TlsConfig
```

_Then run:_

```bash
tlsx
```

To learn more, head over to the [documentation](https://tlsx.sh/).

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/tlsx/releases) page for more information on what has changed recently.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

"Software that is free, but hopes for a postcard." We love receiving postcards from around the world showing where `tlsx` is being used! We showcase them on our website too.

Our address: Stacks.js, 12665 Village Ln #2306, Playa Vista, CA 90094, United States 🌎

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## Credits

- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@stacksjs/tlsx?style=flat-square
[npm-version-href]: https://npmjs.com/package/@stacksjs/tlsx
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/tlsx/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/tlsx/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/tlsx/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/tlsx -->
