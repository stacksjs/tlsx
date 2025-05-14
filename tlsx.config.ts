import type { TlsConfig } from './packages/tlsx/src/types'
import os from 'node:os'
import path from 'node:path'

const config: TlsConfig = {
  domain: 'localhost',
  hostCertCN: 'localhost',
  basePath: '',
  caCertPath: path.join(os.homedir(), '.tlsx', 'ssl', `localhost.ca.crt`),
  certPath: path.join(os.homedir(), '.tlsx', 'ssl', `localhost.crt`),
  keyPath: path.join(os.homedir(), '.tlsx', 'ssl', `localhost.key`),
  altNameIPs: ['127.0.0.1'],
  altNameURIs: ['localhost'],
  organizationName: 'stacksjs.org',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  commonName: 'localhost',
  validityDays: 180,
  verbose: false,
}

export default config
