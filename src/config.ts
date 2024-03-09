import { resolve } from 'node:path'
import { loadConfig } from 'c12'
import type { GenerateCertOptions } from './types'

// Get loaded config
const { config } = await loadConfig({
  name: 'tls',
})

export async function resolveConfig(options?: GenerateCertOptions) {
  const def: GenerateCertOptions = {
    altNameIPs: ['127.0.0.1'],
    altNameURIs: ['localhost'],
    validityDays: 1,
    organizationName: 'tlsx stacks.localhost',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    commonName: 'stacks.localhost',
  }

  let { config } = await loadConfig({
    name: 'tls',
    overrides: options,
    defaults: def,
    cwd: resolve(import.meta.dir, '..'),
  })

  if (!config)
    config = def

  return config
}

export { config }
