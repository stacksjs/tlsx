export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

export interface TlsOptions {
  ssl: {
    altNameIPs: string[]
    altNameURIs: string[]
    commonName: string
    countryName: string
    stateName: string
    localityName: string
    organizationName: string
    validityDays: number
  }
}

export interface GenerateCertOptions {
  output: string
  key: string
  cert: string
  ca: string
  verbose: boolean
}

export type TlsConfig = DeepPartial<TlsOptions>
