import type { TlsConfig } from './types'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from 'bunfig'

export const defaultConfig: TlsConfig = {
  altNameIPs: ['127.0.0.1'],
  altNameURIs: ['localhost'],
  organizationName: 'Local Development',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  commonName: 'stacks.localhost',
  validityDays: 825, // 2 years + 90 days
  hostCertCN: 'stacks.localhost',
  domain: 'stacks.localhost',
  rootCA: { certificate: '', privateKey: '' },
  basePath: '',
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`),
  certPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`),
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`),
  verbose: false,
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: TlsConfig = await loadConfig({
  name: 'tls',
  defaultConfig,
})
