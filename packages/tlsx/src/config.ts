import type { TlsConfig } from './types'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from 'bunfig'

// Default configuration values
export const defaultConfig: TlsConfig = {
  altNameIPs: ['127.0.0.1'],
  altNameURIs: ['localhost'],
  organizationName: 'Local Development',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  commonName: 'tlsx.localhost',
  validityDays: 825, // 2 years + 90 days
  hostCertCN: 'tlsx.localhost',
  domain: 'tlsx.localhost',
  rootCA: { certificate: '', privateKey: '' },
  basePath: '',
  caCertPath: path.join(os.homedir(), '.tlsx', 'ssl', `tlsx.localhost.ca.crt`),
  certPath: path.join(os.homedir(), '.tlsx', 'ssl', `tlsx.localhost.crt`),
  keyPath: path.join(os.homedir(), '.tlsx', 'ssl', `tlsx.localhost.crt.key`),
  verbose: false,
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: TlsConfig = await loadConfig({
  name: 'tlsx',
  alias: 'tls',
  defaultConfig,
})
