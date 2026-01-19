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

// Lazy-loaded config to avoid top-level await (enables bun --compile)
let _config: TlsConfig | null = null

export async function getConfig(): Promise<TlsConfig> {
  if (!_config) {
    _config = await loadConfig({
  name: 'tlsx',
  alias: 'tls',
  defaultConfig,
})
  }
  return _config
}

// For backwards compatibility - synchronous access with default fallback
export const config: TlsConfig = defaultConfig
