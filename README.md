<p align="center"><img src=".github/art/cover.jpg" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# Zero-Config & Setup HTTPS

> A zero-config reverse proxy for local development with SSL support, custom domains, and more.

## Features

- Reverse Proxy
- SSL Support _(HTTPS by default)_
- Custom Domains _(with wildcard support)_
- Auto HTTP-to-HTTPS Redirection
- `/etc/hosts` Management _(auto-updating)_
- Dependency-Free Binary
- Zero-Config Setup

## Install

```bash
bun install -d tlsx
```

_Alternatively, you can install:_

```bash
brew install tlsx # wip
pkgx install tlsx # wip
```

## Get Started

There are two ways of using this reverse proxy: _as a library or as a CLI._

### Library

Given the npm package is installed:

```js
import { startProxy } from 'tlsx'

startProxy({
  from: 'localhost:3000',
  to: 'my-project.localhost' // or try 'my-project.test'
})
```

### CLI

```bash
tlsx --from localhost:3000 --to my-project.localhost
tlsx --from localhost:8080 --to my-project.test --keyPath ./key.pem --certPath ./cert.pem
tlsx --help
tlsx --version
```

## Configuration

The Reverse Proxy can be configured using a `tlsx.config.ts` _(or `tlsx.config.js`)_ file and it will be automatically loaded when running the `tlsx` command.

```ts
// tlsx.config.ts (or tlsx.config.js)
export default {
  'localhost:3000': 'stacks.localhost'
}
```

_Then run:_

```bash
tlsx start
```

To learn more, head over to the [documentation](https://tlsx.sh/).

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

Two things are true: Stacks OSS will always stay open-source, and we do love to receive postcards from wherever Stacks is used! 🌍 _We also publish them on our website. And thank you, Spatie_

Our address: Stacks.js, 5710 Crescent Park #107, Playa Vista 90094, CA.

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
[npm-version-src]: https://img.shields.io/npm/v/tlsx?style=flat-square
[npm-version-href]: https://npmjs.com/package/tlsx
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/tlsx/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/tlsx/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/tlsx/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/tlsx -->
