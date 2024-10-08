export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

export interface TlsOptions {
  ssl: {
    hostCertCN: string
    domain: string
    rootCAObject: { certificate: string; privateKey: string }
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

export interface CertOptions {
  hostCertCN: string
  domain: string
  rootCAObject: { certificate: string; privateKey: string }
  altNameIPs?: string[]
  altNameURIs?: string[]
  validityDays?: number
  organizationName?: string
  countryName?: string
  stateName?: string
  localityName?: string
  commonName?: string
}

export interface CertDetails {
  subject: any
  issuer: any
  validFrom: Date
  validTo: Date
  serialNumber: string
}

export interface AddCertOptions {
  customCertPath?: string
}

export interface GenerateCertReturn {
  certificate: string
  privateKey: string
  notBefore: Date
  notAfter: Date
}

export type TlsConfig = DeepPartial<TlsOptions>
