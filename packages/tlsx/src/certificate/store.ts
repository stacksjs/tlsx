import fs from 'node:fs'
import path from 'node:path'
import type { Cert, CertPath, TlsOption } from '../types'
import { config } from '../config'
import { LOG_CATEGORIES } from '../constants'
import { debugLog, normalizeCertPaths } from '../utils'

/**
 * Store a certificate and its private key
 * @param cert Certificate and private key
 * @param options TLS options
 * @returns Path to the stored certificate
 */
export function storeCertificate(cert: Cert, options?: TlsOption): CertPath {
  debugLog(LOG_CATEGORIES.STORAGE, `Storing certificate and private key with options: ${JSON.stringify(options)}`, options?.verbose)
  const { certPath, keyPath } = normalizeCertPaths({
    basePath: options?.basePath,
    certPath: options?.certPath,
    keyPath: options?.keyPath,
  })

  debugLog(LOG_CATEGORIES.STORAGE, `Certificate path: ${certPath}`, options?.verbose)
  debugLog(LOG_CATEGORIES.STORAGE, `Private key path: ${keyPath}`, options?.verbose)

  // Ensure the certificate directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) {
    debugLog(LOG_CATEGORIES.STORAGE, `Creating certificate directory: ${certDir}`, options?.verbose)
    fs.mkdirSync(certDir, { recursive: true })
  }

  debugLog(LOG_CATEGORIES.STORAGE, 'Writing certificate file', options?.verbose)
  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the key directory exists before writing the file
  const certKeyDir = path.dirname(keyPath)
  if (!fs.existsSync(certKeyDir)) {
    debugLog(LOG_CATEGORIES.STORAGE, `Creating private key directory: ${certKeyDir}`, options?.verbose)
    fs.mkdirSync(certKeyDir, { recursive: true })
  }

  debugLog(LOG_CATEGORIES.STORAGE, 'Writing private key file', options?.verbose)
  fs.writeFileSync(keyPath, cert.privateKey)

  debugLog(LOG_CATEGORIES.STORAGE, 'Certificate and private key stored successfully', options?.verbose)
  return certPath
}

/**
 * Store the CA Certificate
 * @param caCert - The CA Certificate
 * @param options - The options for storing the CA Certificate
 * @returns The path to the CA Certificate
 */
export function storeCACertificate(caCert: string, options?: TlsOption): CertPath {
  debugLog(LOG_CATEGORIES.STORAGE, 'Storing CA certificate', options?.verbose)
  const { caCertPath } = normalizeCertPaths({
    basePath: options?.basePath,
    caCertPath: options?.caCertPath,
  })

  debugLog(LOG_CATEGORIES.STORAGE, `CA certificate path: ${caCertPath}`, options?.verbose)

  // Ensure the directory exists before writing the file
  const caCertDir = path.dirname(caCertPath)
  if (!fs.existsSync(caCertDir)) {
    debugLog(LOG_CATEGORIES.STORAGE, `Creating CA certificate directory: ${caCertDir}`, options?.verbose)
    fs.mkdirSync(caCertDir, { recursive: true })
  }

  debugLog(LOG_CATEGORIES.STORAGE, 'Writing CA certificate file', options?.verbose)
  fs.writeFileSync(caCertPath, caCert)

  debugLog(LOG_CATEGORIES.STORAGE, 'CA certificate stored successfully', options?.verbose)
  return caCertPath
}