import type { TlsConfig } from './types'
import process from 'node:process'
import { loadConfig } from 'bun-config'

// eslint-disable-next-line antfu/no-top-level-await
export const config: TlsConfig = await loadConfig({
  name: 'tls',
  cwd: process.cwd(),
  defaultConfig: {
    altNameIPs: ['127.0.0.1'],
    altNameURIs: ['localhost'],
    organizationName: 'stacksjs.org',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    commonName: 'stacks.localhost',
    validityDays: 1,
    hostCertCN: 'stacks.localhost',
    domain: 'localhost',
    rootCAObject: { certificate: '', privateKey: '' },
  },
})
