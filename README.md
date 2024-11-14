<p align="center"><img src=".github/art/cover.png" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# Zero-Config & Zero-Setup HTTPS

>

## Features

- SSL Support _(HTTPS by default)_
- Automatically Renews Expired Certificates
- Configurable

## Install

```bash
bun install -d @stacksjs/tlsx

# or, invoke immediately
bunx @stacksjs/tlsx
npx @stacksjs/tlsx
```

Please note, we are looking to publish this package to npm under the name `tlsx`. _Hoping npm will release the name for us._

Alternatively, you can install:

```bash
brew install tlsx # wip
pkgx install tlsx # wip
```

## Get Started

There are two ways of using this reverse proxy: _as a library or as a CLI._

### Library

Given the npm package is installed:

```ts
import type { AddCertOptions, CertOptions, TlsConfig, TlsOptions } from '@stacksjs/tlsx'
import { addCertToSystemTrustStoreAndSaveCerts, config, forge, generateCert, pki, storeCert, tls } from '@stacksjs/tlsx'

// ...
```

### CLI

```bash
# more docs incoming
tlsx --help
tlsx version
```

## Configuration

The Reverse Proxy can be configured using a `tls.config.ts` _(or `tls.config.js`)_ file and it will be automatically loaded when running the `tlsx` command.

```ts
// tlsx.config.ts (or tlsx.config.js)
import type { TlsConfig } from './src/types'

export default {
  ssl: {
    altNameIPs: ['127.0.0.1'],
    altNameURIs: ['localhost'],
    organizationName: 'tlsx stacks.localhost',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    commonName: 'stacks.localhost',
    validityDays: 180,
  },
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

Two things are true: Stacks OSS will always stay open-source, and we do love to receive postcards from wherever Stacks is used! 🌍 _We also publish them on our website._

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
