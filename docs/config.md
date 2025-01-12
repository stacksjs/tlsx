# Configuration

`tlsx` can be configured using a `tls.config.ts` _(or `tls.config.js`)_ file and it will be automatically loaded when running the `tlsx` command.

```ts
// tlsx.config.{ts,js}
import type { TlsConfig } from '@stacksjs/tlsx'

export default {
  /**
   * The domain name to use for the certificate.
   * This will be used as the Common Name (CN) in the certificate.
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   * @example 'example.com'
   * @example 'www.example.com'
   * @example 'subdomain.example.com'
   * @example 'subdomain.subdomain.example.com'
   * @example 'my-app.local'
   */
  domain: 'stacks.localhost',

  /**
   * The host certificate Common Name (CN).
   * This is the domain name that the certificate is issued for.
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   * @example 'example.com'
   * @example 'www.example.com'
   * @example 'subdomain.example.com'
   * @example 'subdomain.subdomain.example.com'
   * @example 'my-app.local'
   */
  hostCertCN: 'stacks.localhost',

  /**
   * The path to the CA certificate file.
   * @default '~/.stacks/ssl/tlsx.localhost.ca.crt'
   * @example '~/.stacks/ssl/tlsx.localhost.ca.crt'
   * @example '~/.stacks/ssl/ca.crt'
   * @example '/etc/ssl/ca.crt'
   * @example '/usr/local/etc/ssl/tlsx.localhost.ca.crt'
   */
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.ca.crt`),

  /**
   * The path to the certificate file.
   * @default '~/.stacks/ssl/tlsx.localhost.crt'
   * @example '/etc/ssl/tlsx.localhost.crt'
   * @example '/usr/local/etc/ssl/tlsx.localhost.crt'
   */
  certPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt`),

  /**
   * The path to the private key file.
   * @default '~/.stacks/ssl/tlsx.localhost.crt.key'
   * @example '/etc/ssl/tlsx.localhost.crt.key'
   * @example '/usr/local/etc/ssl/tlsx.localhost.crt.key'
   */
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt.key`),

  /**
   * Alternative name IP addresses.
   * @default ['127.0.0.1']
   * @example ['127.0.0.1']
   */
  altNameIPs: ['127.0.0.1'],

  /**
   * Alternative name URIs.
   * @default ['localhost']
   * @example ['localhost']
   */
  altNameURIs: ['localhost'],

  /**
   * Organization name.
   * @default 'stacksjs.org'
   * @example 'stacksjs.org'
   * @example 'example.com'
   * @example 'My Company, Inc.'
   */
  organizationName: 'stacksjs.org',

  /**
   * Country name.
   * @default 'US'
   * @example 'US'
   * @example 'DE'
   * @example 'CA'
   * @example 'GB'
   */
  countryName: 'US',

  /**
   * State name.
   * @default 'California'
   * @example 'California'
   * @example 'New York'
   * @example 'Texas'
   * @example 'Florida'
   */
  stateName: 'California',

  /**
   * Locality name.
   * @default 'Playa Vista'
   * @example 'Playa Vista'
   * @example 'Los Angeles'
   * @example 'San Francisco'
   * @example 'New York'
   */
  localityName: 'Playa Vista',

  /**
   * The common name for the certificate.
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   * @example 'example.com'
   * @example 'www.example.com'
   * @example 'subdomain.example.com'
   * @example 'subdomain.subdomain.example.com'
   * @example 'my-app.local'
   * @example 'localhost'
   */
  commonName: 'stacks.localhost',

  /**
   * The number of days the certificate is valid for.
   * @default 180
   * @example 180
   * @example 365
   * @example 730
   * @example 1095
   */
  validityDays: 180,

  /**
   * Verbose output.
   * @default false
   * @example true
   */
  verbose: false,
} satisfies TlsConfig
```

_Then run:_

```bash
./tlsx
```
