export interface TlsConfig {
  hostCertCN: string
  domain: string
  altNameIPs: string[]
  altNameURIs: string[]
  validityDays: number
  organizationName: string
  countryName: string
  stateName: string
  localityName: string
  commonName: string
  basePath: string
  keyPath: string
  certPath: string
  caCertPath: string
  subjectAltNames?: SubjectAltName[]
  rootCA?: { certificate: string, privateKey: string }
  keyUsage?: {
    digitalSignature: boolean
    contentCommitment: boolean
    keyEncipherment: boolean
    dataEncipherment: boolean
    keyAgreement: boolean
    keyCertSign: boolean
    cRLSign: boolean
    encipherOnly: boolean
    decipherOnly: boolean
  }
  extKeyUsage?: {
    serverAuth: boolean
    clientAuth: boolean
    codeSigning: boolean
    emailProtection: boolean
    timeStamping: boolean
  }
  basicConstraints?: {
    cA: boolean
    pathLenConstraint: number
  }
  isCA?: boolean
  certificateAttributes?: Array<{
    shortName: string
    value: string
  }>
  verbose: boolean
}

type DnsType = 2
type IpType = 7
export interface SubjectAltName {
  type: DnsType | IpType | number
  value: string
}

export interface CertificateOptions {
  domain: string
  rootCA: { certificate: string, privateKey: string }
  hostCertCN?: string
  altNameIPs?: string[]
  altNameURIs?: string[]
  validityDays?: number
  organizationName?: string
  countryName?: string
  stateName?: string
  localityName?: string
  commonName?: string
  subjectAltNames?: SubjectAltName[]
  keyUsage?: {
    digitalSignature?: boolean
    contentCommitment?: boolean
    keyEncipherment?: boolean
    dataEncipherment?: boolean
    keyAgreement?: boolean
    keyCertSign?: boolean
    cRLSign?: boolean
    encipherOnly?: boolean
    decipherOnly?: boolean
  }
  extKeyUsage?: {
    serverAuth?: boolean
    clientAuth?: boolean
    codeSigning?: boolean
    emailProtection?: boolean
    timeStamping?: boolean
  }
  basicConstraints?: {
    cA?: boolean
    pathLenConstraint?: number
  }
  isCA?: boolean
  certificateAttributes?: Array<{
    shortName: string
    value: string
  }>
  verbose?: boolean
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
  verbose?: boolean
}

export interface Certificate {
  certificate: string
  privateKey: string
  notBefore: Date
  notAfter: Date
}

export type TlsOption = DeepPartial<TlsConfig>

export interface CAOptions extends TlsOption {
  validityYears?: number
  keySize?: number
  organization?: string
  organizationalUnit?: string
  commonName?: string
  extraAttributes?: Array<{
    shortName: string
    value: string
  }>
}

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}
