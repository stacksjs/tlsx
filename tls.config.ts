import type { TlsConfig } from './src/types'

export default {
  ssl: {
    altNameIPs: ['127.0.0.1'],
    altNameURIs: ['localhost'],
    organizationName: 'tlsx stacks.localhost',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    commonName: 'stacks.localhost',
    validityDays: 1,
  },
} satisfies TlsConfig
