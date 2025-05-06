/**
 * Configuration options for TLS certificates.
 */
export interface TlsConfig {
  /**
   * Common name of the host certificate.
   *
   * This is the domain name that the certificate is issued for.
   *
   * @default 'stacks.localhost'
   *
   * @example 'stacks.localhost'
   *
   */
  hostCertCN: string
  /**
   * Domain name of the certificate.
   *
   * This will be used as the Common Name (CN) in the certificate.
   *
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   */
  domain: string
  /**
   * Alternative names for the certificate.
   *
   * @default ['stacks.localhost']
   * @example ['stacks.localhost']
   * @example ['api.example.com', 'www.example.com']
   * @example ['api.example.com', '*.example.com']
   */
  domains?: string[]
  /**
   * Alternative IP addresses for the certificate.
   *
   * @default ['127.0.0.1']
   * @example ['127.0.0.1']
   * @example ['api.example.com', 'www.example.com']
   * @example ['api.example.com', '*.example.com']
   * @example ['127.0.0.1', '244.178.44.111']
   */
  altNameIPs: string[]
  /**
   * Alternative URIs for the certificate.
   *
   * @default ['stacks.localhost']
   * @example ['stacks.localhost']
   * @example ['api.example.com', 'www.example.com']
   * @example ['api.example.com', '*.example.com']
   */
  altNameURIs: string[]
  /**
   * Number of days the certificate is valid for.
   *
   * @default 365
   * @example 365
   * @example 730
   */
  validityDays: number

  /**
   * Organization name for the certificate.
   *
   * @default 'Stacks.js'
   * @example 'Stacks.js'
   * @example 'My Company, Inc.'
   */
  organizationName: string

  /**
   * Country name for the certificate.
   *
   * @default 'US'
   * @example 'US'
   * @example 'DE'
   * @example 'CA'
   * @example 'GB'
   */
  countryName: string

  /**
   * State name for the certificate.
   *
   * @default 'California'
   * @example 'California'
   * @example 'New York'
   * @example 'Texas'
   */
  stateName: string

  /**
   * Locality name for the certificate.
   *
   * @default 'Playa Vista'
   * @example 'San Francisco'
   * @example 'Los Angeles'
   * @example 'New York'
   */
  localityName: string

  /**
   * Common name for the certificate.
   *
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   * @example 'api.example.com'
   * @example 'www.example.com'
   */
  commonName: string

  /**
   * Path to the base directory for the certificate files.
   *
   * @default '.stacks/ssl'
   * @example '.stacks/ssl'
   * @example '/etc/ssl'
   * @example '/usr/local/etc/ssl'
   * @example 'C:\\Windows\\System32\\certsrv\\CertEnroll'
   */
  basePath: string

  /**
   * Path to the certificate file.
   *
   * @default 'stacks.localhost.crt'
   * @example '.stacks/ssl/stacks.localhost.crt'
   * @example '/etc/ssl/stacks.localhost.crt'
   * @example '/usr/local/etc/ssl/stacks.localhost.crt'
   * @example 'C:\\Windows\\System32\\certsrv\\CertEnroll\\stacks.localhost.crt'
   */
  certPath: string

  /**
   * Path to the key file.
   *
   * @default 'stacks.localhost.crt.key'
   * @example '.stacks/ssl/stacks.localhost.crt.key'
   * @example '/etc/ssl/stacks.localhost.crt.key'
   * @example '/usr/local/etc/ssl/stacks.localhost.crt.key'
   * @example 'C:\\Windows\\System32\\certsrv\\CertEnroll\\stacks.localhost.crt.key'
   */
  keyPath: string

  /**
   * Path to the CA certificate file.
   *
   * @default '.stacks/ssl/stacks.localhost.ca.crt'
   * @example '.stacks/ssl/stacks.localhost.ca.crt'
   * @example '/etc/ssl/stacks.localhost.ca.crt'
   * @example '/usr/local/etc/ssl/stacks.localhost.ca.crt'
   * @example 'C:\\Windows\\System32\\certsrv\\CertEnroll\\stacks.localhost.ca.crt'
   */
  caCertPath: string

  /**
   * Subject alternative names for the certificate.
   *
   * @default []
   * @example []
   * @example ['example.com']
   * @example ['example.com', 'www.example.com']
   * @example ['example.com', 'www.example.com', 'api.example.com']
   */
  subjectAltNames?: SubjectAltName[]

  /**
   * Root CA certificate and private key.
   *
   * @example { certificate: '...', privateKey: '...' }
   */
  rootCA?: { certificate: string, privateKey: string }

  /**
   * Key usage options for the certificate.
   *
   * @default { digitalSignature: true, keyCertSign: true }
   * @example { digitalSignature: true, keyCertSign: true }
   * @example { digitalSignature: true, keyCertSign: true, cRLSign: true }
   * @example { digitalSignature: true, keyCertSign: true, cRLSign: true, encipherOnly: true }
   */
  keyUsage?: {
    /**
     * Digital signature key usage.
     */
    digitalSignature: boolean
    /**
     * Content commitment key usage.
     */
    contentCommitment: boolean
    /**
     * Key encipherment key usage.
     */
    keyEncipherment: boolean
    /**
     * Data encipherment key usage.
     */
    dataEncipherment: boolean
    /**
     * Key agreement key usage.
     */
    keyAgreement: boolean
    /**
     * Key certificate signing key usage.
     */
    keyCertSign: boolean
    /**
     * Certificate revocation list signing key usage.
     */
    cRLSign: boolean
    /**
     * Key encipherment key usage.
     */
    encipherOnly: boolean
    /**
     * Key decipherment key usage.
     */
    decipherOnly: boolean
  }

  /**
   * Extended key usage options for the certificate.
   *
   * @default { serverAuth: true, clientAuth: true }
   * @example { serverAuth: true, clientAuth: true }
   * @example { serverAuth: true, clientAuth: true, codeSigning: true }
   * @example { serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true, timeStamping: true }
   */
  extKeyUsage?: {
    /**
     * Server authentication key usage.
     */
    serverAuth?: boolean
    /**
     * Client authentication key usage.
     */
    clientAuth?: boolean
    /**
     * Code signing key usage.
     */
    codeSigning?: boolean
    /**
     * Email protection key usage.
     */
    emailProtection?: boolean
    /**
     * Time stamping key usage.
     */
    timeStamping?: boolean
  }
  /**
   * Basic constraints for the certificate.
   *
   * @default { cA: false, pathLenConstraint: undefined }
   * @example { cA: false, pathLenConstraint: undefined }
   * @example { cA: true, pathLenConstraint: 3 }
   */
  basicConstraints?: {
    /**
     * Certificate authority (CA) flag.
     */
    cA: boolean
    /**
     * Path length constraint.
     */
    pathLenConstraint: number
  }
  /**
   * Certificate authority (CA) flag.
   */
  isCA?: boolean
  /**
   * Certificate attributes.
   *
   * @default []
   * @example []
   * @example [{ shortName: 'C', value: 'US' }, { shortName: 'ST', value: 'California' }]
   */
  certificateAttributes?: Array<{
    shortName: string
    value: string
  }>
  /**
   * Verbose mode flag.
   *
   * @default false
   * @example false
   * @example true
   */
  verbose: boolean
}

type DnsType = 2
type IpType = 7

/**
 * Subject Alternative Name
 */
export interface SubjectAltName {
  type: DnsType | IpType | number
  value: string
}

/**
 * Certificate generation options
 */
export interface CertificateOptions {
  /**
   * Common name (CN).
   *
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   * @example 'example.com'
   * @example 'www.example.com'
   * @example 'subdomain.example.com'
   * @example 'subdomain.subdomain.example.com'
   * @example 'my-app.local'
   * @example 'localhost'
   */
  domain?: string

  /**
   * Domains.
   *
   * @default ['stacks.localhost']
   * @example ['example.com', 'www.example.com']
   * @example ['subdomain.example.com', 'subdomain2.example.com']
   * @example ['my-app.local']
   * @example ['localhost']
   */
  domains?: string[]

  /**
   * Root CA.
   *
   * @example { certificate: '...', privateKey: '...' }
   * @example null
   */
  rootCA?: { certificate: string, privateKey: string }

  /**
   * Host certificate common name.
   *
   * @default 'stacks.localhost'
   * @example 'stacks.localhost'
   * @example 'example.com'
   * @example 'www.example.com'
   * @example 'subdomain.example.com'
   * @example 'subdomain.subdomain.example.com'
   * @example 'my-app.local'
   * @example 'localhost'
   */
  hostCertCN?: string

  /**
   * Alternative names.
   *
   * @example ['example.com', 'www.example.com']
   * @example ['subdomain.example.com', 'subdomain2.example.com']
   * @example ['my-app.local']
   * @example ['localhost']
   */
  altNameIPs?: string[]

  /**
   * Alternative names.
   *
   * @example ['example.com', 'www.example.com']
   * @example ['subdomain.example.com', 'subdomain2.example.com']
   * @example ['my-app.local']
   * @example ['localhost']
   */
  altNameURIs?: string[]

  /**
   * Validity days.
   *
   * @default 180
   * @example 180
   * @example 365
   * @example 730
   * @example 1095
   */
  validityDays?: number

  /**
   * Organization name.
   *
   * @default 'Local Development'
   * @example 'Local Development'
   * @example 'My Company, Inc.'
   */
  organizationName?: string

  /**
   * Country name.
   *
   * @default 'US'
   * @example 'US'
   * @example 'CA'
   * @example 'DE'
   */
  countryName?: string

  /**
   * State name.
   *
   * @default 'California'
   * @example 'California'
   * @example 'New York'
   * @example 'Hawaii'
   */
  stateName?: string

  /**
   * Locality name.
   *
   * @default 'Playa Vista'
   * @example 'Playa Vista'
   * @example 'San Francisco'
   * @example 'Los Angeles'
   */
  localityName?: string

  /**
   * Common name.
   *
   * @default 'localhost'
   * @example 'localhost'
   * @example 'example.com'
   * @example 'api.example.com'
   */
  commonName?: string

  /**
   * Subject alternative names.
   *
   * @example [{ type: 'DNS', value: 'example.com' }]
   * @example [{ type: 'DNS', value: 'example.com' }, { type: 'DNS', value: 'api.example.com' }]
   * @example [{ type: 'IP', value: '1.2.3.4' }]
   */
  subjectAltNames?: SubjectAltName[]

  /**
   * Key usage.
   *
   * @example { digitalSignature: true, contentCommitment: true }
   */
  keyUsage?: {
    /**
     * Digital signature key usage.
     *
     * @default false
     * @example true
     */
    digitalSignature?: boolean

    /**
     * Content commitment key usage.
     *
     * @default false
     * @example true
     */
    contentCommitment?: boolean
    /**
     * Key encipherment key usage.
     *
     * @default false
     * @example true
     */
    keyEncipherment?: boolean

    /**
     * Data encipherment key usage.
     *
     * @default false
     * @example true
     */
    dataEncipherment?: boolean

    /**
     * Key agreement key usage.
     *
     * @default false
     * @example true
     */
    keyAgreement?: boolean

    /**
     * Key certificate sign key usage.
     *
     * @default false
     * @example true
     */
    keyCertSign?: boolean

    /**
     * CRL sign key usage.
     *
     * @default false
     * @example true
     */
    cRLSign?: boolean

    /**
     * Encipher only key usage.
     *
     * @default false
     * @example true
     */
    encipherOnly?: boolean

    /**
     * Decipher only key usage.
     *
     * @default false
     * @example true
     */
    decipherOnly?: boolean
  }

  /**
   * Extended key usage key usage.
   *
   * @default {}
   * @example { serverAuth: true, clientAuth: true }
   */
  extKeyUsage?: {
    /**
     * Server authentication key usage.
     *
     * @default false
     * @example true
     */
    serverAuth?: boolean

    /**
     * Client authentication key usage.
     *
     * @default false
     * @example true
     */
    clientAuth?: boolean
    /**
     * Code signing key usage.
     *
     * @default false
     * @example true
     */
    codeSigning?: boolean

    /**
     * Email protection key usage.
     *
     * @default false
     * @example true
     */
    emailProtection?: boolean

    /**
     * Time-stamping key usage.
     * @default false
     * @example true
     */
    timeStamping?: boolean
  }

  /**
   * Basic constraints key usage.
   *
   * @default {}
   * @example { cA: true, pathLenConstraint: 2 }
   */
  basicConstraints?: {
    /**
     * CA key usage.
     *
     * @default false
     * @example true
     */
    cA?: boolean

    /**
     * Path length constraint key usage.
     *
     * @default 0
     * @example 2
     */
    pathLenConstraint?: number
  }

  /**
   * Is CA key usage.
   *
   * @default false
   * @example true
   */
  isCA?: boolean

  /**
   * Certificate attributes key usage.
   *
   * @default []
   * @example [{ shortName: 'commonName', value: 'example.com' }]
   */
  certificateAttributes?: Array<{
    shortName: string
    value: string
  }>

  /**
   * Verbose output.
   *
   * @default false
   * @example true
   */
  verbose?: boolean
}

type Subject = any
type Issuer = any

/**
 * Certificate details.
 */
export interface CertDetails {
  subject: Subject
  issuer: Issuer
  validFrom: Date
  validTo: Date
  serialNumber: string
}

/**
 * Options for adding a certificate.
 */
export interface AddCertOption {
  customCertPath?: string
  verbose?: boolean
}

/**
 * Certificate details.
 */
export interface Certificate {
  certificate: string
  privateKey: string
  notBefore: Date
  notAfter: Date
}

/**
 * TLS configuration options.
 */
export type TlsOption = DeepPartial<TlsConfig>

/**
 * Options for generating a CA certificate.
 */
export interface CAOptions extends TlsOption {
  /**
   * Validity period for the CA certificate.
   * @default 100 years
   */
  validityYears?: number

  /**
   * Size of the RSA key for the CA certificate.
   * @default 2048
   */
  keySize?: number

  /**
   * Organization for the CA certificate.
   * @default 'Local Development CA'
   */
  organization?: string

  /**
   * Organizational unit for the CA certificate.
   * @default 'Certificate Authority'
   */
  organizationalUnit?: string

  /**
   * Common name for the CA certificate.
   * @default 'Local Development Root CA'
   */
  commonName?: string

  /**
   * Extra attributes for the CA certificate.
   * @default []
   * @example [{ shortName: 'C', value: 'US' }, { shortName: 'ST', value: 'California' }]
   */
  extraAttributes?: Array<{
    shortName: string
    value: string
  }>
}

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

/**
 * Certificate and private key.
 */
export interface Cert {
  certificate: string
  privateKey: string
}

/**
 * Path to a certificate file.
 */
export type CertPath = string

/**
 * Random serial number for a certificate.
 */
export type RandomSerialNumber = string

/**
 * Basic constraints for a certificate.
 */
export interface BasicConstraintsExtension {
  name: 'basicConstraints'
  cA: boolean
  pathLenConstraint?: number
  critical: boolean
}

/**
 * Key usage for a certificate.
 */
export interface KeyUsageExtension {
  /**
   * Name of the key usage extension.
   */
  name: 'keyUsage'

  /**
   * Whether the key usage extension is critical.
   */
  critical: boolean

  /**
   * Whether the key usage extension includes the digital signature key usage.
   */
  digitalSignature?: boolean

  /**
   * Whether the key usage extension includes the content commitment key usage.
   */
  contentCommitment?: boolean

  /**
   * Whether the key usage extension includes the key encipherment key usage.
   */
  keyEncipherment?: boolean

  /**
   * Whether the key usage extension includes the data encipherment key usage.
   */
  dataEncipherment?: boolean

  /**
   * Whether the key usage extension includes the key agreement key usage.
   */
  keyAgreement?: boolean

  /**
   * Whether the key usage extension includes the key certificate signing key usage.
   */
  keyCertSign?: boolean

  /**
   * Whether the key usage extension includes the certificate revocation signing key usage.
   */
  cRLSign?: boolean

  /**
   * Whether the key usage extension includes the encipher only key usage.
   */
  encipherOnly?: boolean

  /**
   * Whether the key usage extension includes the decipher only key usage.
   */
  decipherOnly?: boolean
}

/**
 * Extended key usage for a certificate.
 */
export interface ExtKeyUsageExtension {
  name: 'extKeyUsage'
  serverAuth?: boolean
  clientAuth?: boolean
  codeSigning?: boolean
  emailProtection?: boolean
  timeStamping?: boolean
}

/**
 * Subject alternative name for a certificate.
 */
export interface SubjectAltNameExtension {
  name: 'subjectAltName'
  altNames: SubjectAltName[]
}

/**
 * Certificate extension.
 */
export type CertificateExtension =
  | BasicConstraintsExtension
  | KeyUsageExtension
  | ExtKeyUsageExtension
  | SubjectAltNameExtension
