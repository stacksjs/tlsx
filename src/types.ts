export interface TlsConfig {
  ssl: {
    commonName: string
    countryName: string
    stateName: string
    localityName: string
    organizationName: string
    organizationalUnitName: string
    validityYears: number
  }
}

export interface GenerateCertOptions {
  altNameIPs?: string[]
  altNameURIs?: string[]
  validityDays?: number
}
