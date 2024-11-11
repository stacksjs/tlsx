import type { TlsConfig } from './types'
import { loadConfig } from 'bun-config'

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
  }
})
