export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
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
  altNameIPs?: string[]
  altNameURIs?: string[]
  validityDays?: number
  organizationName?: string
  countryName?: string
  stateName?: string
  localityName?: string
  commonName?: string
}

export type TlsConfig = DeepPartial<TlsOptions>
