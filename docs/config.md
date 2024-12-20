# Configuration

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
