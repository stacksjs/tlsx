export interface TlsConfig {
  hostCertCN: string
  domain: string
  caCertPath: string
  certPath: string
  keyPath: string
  rootCAObject: { certificate: string, privateKey: string }
  altNameIPs: string[]
  altNameURIs: string[]
  commonName: string
  countryName: string
  stateName: string
  localityName: string
  organizationName: string
  validityDays: number
}

export interface CertOption {
  hostCertCN: string
  domain: string
  rootCAObject: { certificate: string, privateKey: string }
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

export interface AddCertOption {
  customCertPath?: string
}

export interface GenerateCertReturn {
  certificate: string
  privateKey: string
  notBefore: Date
  notAfter: Date
}

export type TlsOption = DeepPartial<TlsConfig>

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}
