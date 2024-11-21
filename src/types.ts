export interface TlsConfig {
  hostCertCN: string
  domain: string
  rootCAObject: { certificate: string, privateKey: string }
  altNameIPs: string[]
  altNameURIs: string[]
  validityDays: number
  organizationName: string
  countryName: string
  stateName: string
  localityName: string
  commonName: string
  subjectAltNames: SubjectAltName[]
  keyUsage: {
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
  extKeyUsage: {
    serverAuth: boolean
    clientAuth: boolean
    codeSigning: boolean
    emailProtection: boolean
    timeStamping: boolean
  }
  basicConstraints: {
    cA: boolean
    pathLenConstraint: number
  }
  isCA: boolean
  certificateAttributes: Array<{
    shortName: string
    value: string
  }>
  verbose: boolean
}

export interface SubjectAltName {
  type: number // 2 for DNS, 7 for IP
  value: string
}

export interface CertificateOptions {
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

export interface GenerateCertReturn {
  certificate: string
  privateKey: string
  notBefore: Date
  notAfter: Date
}

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

export type TlsOption = DeepPartial<TlsConfig>

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}
