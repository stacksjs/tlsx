# Install

```bash
bun install -d @stacksjs/tlsx

# or, invoke immediately
bunx @stacksjs/tlsx
npx @stacksjs/tlsx
```

Please note, we are looking to publish this package to npm under the name `tlsx`. _Hoping npm will release the name for us._

<!-- _Alternatively, you can install:_

```bash
brew install tlsx # wip
pkgx install tlsx # wip
``` -->

## Usage

There are two ways of using this reverse proxy: _as a library or as a CLI._

### Library

Given the npm package is installed:

```ts
import type { AddCertOptions, CAOptions, CertificateOptions, TlsConfig, TlsOptions } from '@stacksjs/tlsx'
import { addCertToSystemTrustStoreAndSaveCerts, config, forge, generateCert, pki, storeCertificate, tls } from '@stacksjs/tlsx'

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
