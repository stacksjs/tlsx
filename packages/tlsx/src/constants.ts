/**
 * Certificate-related constants
 */
export const CERT_CONSTANTS = {
  /**
   * Default key size for RSA keys (in bits)
   */
  DEFAULT_KEY_SIZE: 2048,

  /**
   * Default validity period for certificates (in days)
   */
  DEFAULT_VALIDITY_DAYS: 825, // 2 years + 90 days

  /**
   * Default validity period for CA certificates (in years)
   */
  DEFAULT_CA_VALIDITY_YEARS: 100,

  /**
   * Default days to subtract from the current date for the "not before" date
   */
  DEFAULT_NOT_BEFORE_DAYS: 2,

  /**
   * Default trust arguments for Linux certificates
   */
  LINUX_TRUST_ARGS: 'TC, C, C',

  /**
   * Default certificate database file name for Linux
   */
  LINUX_CERT_DB_FILENAME: 'cert9.db',
}

/**
 * File path constants
 */
export const PATH_CONSTANTS = {
  /**
   * Default directory name for storing certificates
   */
  DEFAULT_CERT_DIR: '.stacks/ssl',

  /**
   * Default file extension for certificates
   */
  CERT_EXTENSION: '.crt',

  /**
   * Default file extension for private keys
   */
  KEY_EXTENSION: '.crt.key',

  /**
   * Default file extension for CA certificates
   */
  CA_CERT_EXTENSION: '.ca.crt',
}

/**
 * Debug log categories
 */
export const LOG_CATEGORIES = {
  CERT: 'cert',
  CA: 'ca',
  STORAGE: 'storage',
  TRUST: 'trust',
}