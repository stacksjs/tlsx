import type { TlsConfig } from './src/types'

export default {
  ssl: {
    commonName: 'stacks.localhost',
    countryName: 'US',
    stateName: 'California',
    localityName: 'Playa Vista',
    organizationName: 'Stacks',
    organizationalUnitName: 'Acme',
    validityYears: 1,
  },
} satisfies TlsConfig
