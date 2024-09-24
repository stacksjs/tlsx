import { resolve } from 'node:path'
import { loadConfig } from 'c12'
import type { TlsOptions } from './types'

const { config } = await loadConfig({
  name: 'tls',
})

export async function resolveConfig(options?: TlsOptions): Promise<TlsOptions> {
  const def: TlsOptions = {
    ssl: {
      hostCertCN: 'Stacks tlsx RootCA',
      domain: 'stacks.localhost',
      rootCAObject: {
        certificate: '',
        privateKey: '',
      },
      altNameIPs: ['127.0.0.1'],
      altNameURIs: ['localhost'],
      validityDays: 1,
      organizationName: 'Stacks.js',
      countryName: 'US',
      stateName: 'California',
      localityName: 'Playa Vista',
      commonName: 'stacks.localhost',
    },
  }

  let { config } = await loadConfig({
    name: 'tls',
    overrides: options,
    defaults: def,
    cwd: resolve(import.meta.dir, '..'),
  })

  if (!config) config = def

  return config
}

export { config }
