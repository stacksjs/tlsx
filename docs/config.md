# Configuration

`tlsx` can be configured using a `tls.config.ts` _(or `tls.config.js`)_ file and it will be automatically loaded when running the `tlsx` command.

```ts
// tlsx.config.{ts,js}
import type { TlsConfig } from '@stacksjs/tlsx'

export default {
  /**

   _ The domain name to use for the certificate.
   _ This will be used as the Common Name (CN) in the certificate.
   _ @default 'stacks.localhost'
   _ @example 'stacks.localhost'
   _ @example 'example.com'
   _ @example 'www.example.com'
   _ @example 'subdomain.example.com'
   _ @example 'subdomain.subdomain.example.com'
   _ @example 'my-app.local'

   _/
  domain: 'stacks.localhost',

  /**

   _ The host certificate Common Name (CN).
   _ This is the domain name that the certificate is issued for.
   _ @default 'stacks.localhost'
   _ @example 'stacks.localhost'
   _ @example 'example.com'
   _ @example 'www.example.com'
   _ @example 'subdomain.example.com'
   _ @example 'subdomain.subdomain.example.com'
   _ @example 'my-app.local'

   _/
  hostCertCN: 'stacks.localhost',

  /**

   _ The path to the CA certificate file.
   _ @default '~/.stacks/ssl/tlsx.localhost.ca.crt'
   _ @example '~/.stacks/ssl/tlsx.localhost.ca.crt'
   _ @example '~/.stacks/ssl/ca.crt'
   _ @example '/etc/ssl/ca.crt'
   _ @example '/usr/local/etc/ssl/tlsx.localhost.ca.crt'

   */
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.ca.crt`),

  /**

   _ The path to the certificate file.
   _ @default '~/.stacks/ssl/tlsx.localhost.crt'
   _ @example '/etc/ssl/tlsx.localhost.crt'
   _ @example '/usr/local/etc/ssl/tlsx.localhost.crt'

   */
  certPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt`),

  /**

   _ The path to the private key file.
   _ @default '~/.stacks/ssl/tlsx.localhost.crt.key'
   _ @example '/etc/ssl/tlsx.localhost.crt.key'
   _ @example '/usr/local/etc/ssl/tlsx.localhost.crt.key'

   */
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', `tlsx.localhost.crt.key`),

  /**

   _ Alternative name IP addresses.
   _ @default ['127.0.0.1']
   _ @example ['127.0.0.1']

   _/
  altNameIPs: ['127.0.0.1'],

  /**

   _ Alternative name URIs.
   _ @default ['localhost']
   _ @example ['localhost']

   _/
  altNameURIs: ['localhost'],

  /**

   _ Organization name.
   _ @default 'stacksjs.org'
   _ @example 'stacksjs.org'
   _ @example 'example.com'
   _ @example 'My Company, Inc.'

   _/
  organizationName: 'stacksjs.org',

  /**

   _ Country name.
   _ @default 'US'
   _ @example 'US'
   _ @example 'DE'
   _ @example 'CA'
   _ @example 'GB'

   */
  countryName: 'US',

  /**

   _ State name.
   _ @default 'California'
   _ @example 'California'
   _ @example 'New York'
   _ @example 'Texas'
   _ @example 'Florida'

   */
  stateName: 'California',

  /**

   _ Locality name.
   _ @default 'Playa Vista'
   _ @example 'Playa Vista'
   _ @example 'Los Angeles'
   _ @example 'San Francisco'
   _ @example 'New York'

   */
  localityName: 'Playa Vista',

  /**

   _ The common name for the certificate.
   _ @default 'stacks.localhost'
   _ @example 'stacks.localhost'
   _ @example 'example.com'
   _ @example 'www.example.com'
   _ @example 'subdomain.example.com'
   _ @example 'subdomain.subdomain.example.com'
   _ @example 'my-app.local'
   _ @example 'localhost'

   _/
  commonName: 'stacks.localhost',

  /**

   _ The number of days the certificate is valid for.
   _ @default 180
   _ @example 180
   _ @example 365
   _ @example 730
   _ @example 1095

   */
  validityDays: 180,

  /**

   _ Verbose output.
   _ @default false
   _ @example true

   _/
  verbose: false,
} satisfies TlsConfig
```

_Then run:_

```bash
./tlsx
```
