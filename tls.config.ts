import type { TlsConfig } from './src/types'

const config: TlsConfig = {
  domain: 'localhost',
  hostCertCN: 'stacks.localhost',
  rootCAObject: {
    certificate: '',
    privateKey: '',
  },
  altNameIPs: ['127.0.0.1'],
  altNameURIs: ['localhost'],
  organizationName: 'stacksjs.org',
  countryName: 'US',
  stateName: 'California',
  localityName: 'Playa Vista',
  commonName: 'stacks.localhost',
  validityDays: 1,
}

export default config
