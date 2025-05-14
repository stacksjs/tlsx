import type { TlsConfig } from './types'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from 'bunfig'

/**
 * Get a value from environment variables or return a default value
 * @param key - Environment variable key
 * @param defaultValue - Default value if environment variable is not set
 * @returns The environment variable value or default value
 */
function getEnvOrDefault<T>(key: string, defaultValue: T): T {
  const envValue = process.env[key]
  return envValue !== undefined ? (envValue as unknown as T) : defaultValue
}

// Default configuration values
export const defaultConfig: TlsConfig = {
  altNameIPs: getEnvOrDefault('TLSX_ALT_NAME_IPS', ['127.0.0.1']),
  altNameURIs: getEnvOrDefault('TLSX_ALT_NAME_URIS', ['localhost']),
  organizationName: getEnvOrDefault('TLSX_ORGANIZATION_NAME', 'Local Development'),
  countryName: getEnvOrDefault('TLSX_COUNTRY_NAME', 'US'),
  stateName: getEnvOrDefault('TLSX_STATE_NAME', 'California'),
  localityName: getEnvOrDefault('TLSX_LOCALITY_NAME', 'Playa Vista'),
  commonName: getEnvOrDefault('TLSX_COMMON_NAME', 'stacks.localhost'),
  validityDays: getEnvOrDefault('TLSX_VALIDITY_DAYS', 825), // 2 years + 90 days
  hostCertCN: getEnvOrDefault('TLSX_HOST_CERT_CN', 'stacks.localhost'),
  domain: getEnvOrDefault('TLSX_DOMAIN', 'stacks.localhost'),
  rootCA: { certificate: '', privateKey: '' },
  basePath: getEnvOrDefault('TLSX_BASE_PATH', ''),
  caCertPath: getEnvOrDefault('TLSX_CA_CERT_PATH', path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.ca.crt`)),
  certPath: getEnvOrDefault('TLSX_CERT_PATH', path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`)),
  keyPath: getEnvOrDefault('TLSX_KEY_PATH', path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt.key`)),
  verbose: getEnvOrDefault('TLSX_VERBOSE', false),
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: TlsConfig = await loadConfig({
  name: 'tls',
  defaultConfig,
})
