import fs from 'node:fs'
import path from 'node:path'
import type { Cert, CertPath, TlsOption } from '../types'
import { config } from '../config'
import { LOG_CATEGORIES } from '../constants'
import { debugLog } from '../utils'

/**
 * Store a certificate and its private key
 * @param cert Certificate and private key
 * @param options TLS options
 * @returns Path to the stored certificate
 */
export function storeCertificate(cert: Cert, options?: TlsOption): CertPath {
  debugLog(LOG_CATEGORIES.STORAGE, `Storing certificate and private key with options: ${JSON.stringify(options)}`, options?.verbose)
  const certPath = path.join(options?.basePath || config.basePath, options?.certPath || config.certPath)
  const certKeyPath = path.join(options?.basePath || config.basePath, options?.keyPath || config.keyPath)

  debugLog(LOG_CATEGORIES.STORAGE, `Certificate path: ${certPath}`, options?.verbose)
  debugLog(LOG_CATEGORIES.STORAGE, `Private key path: ${certKeyPath}`, options?.verbose)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) {
    debugLog(LOG_CATEGORIES.STORAGE, `Creating certificate directory: ${certDir}`, options?.verbose)
    fs.mkdirSync(certDir, { recursive: true })
  }

  debugLog(LOG_CATEGORIES.STORAGE, 'Writing certificate file', options?.verbose)
  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the directory exists before writing the file
  const certKeyDir = path.dirname(certKeyPath)
  if (!fs.existsSync(certKeyDir)) {
    debugLog(LOG_CATEGORIES.STORAGE, `Creating private key directory: ${certKeyDir}`, options?.verbose)
    fs.mkdirSync(certKeyDir, { recursive: true })
  }

  debugLog(LOG_CATEGORIES.STORAGE, 'Writing private key file', options?.verbose)
  fs.writeFileSync(certKeyPath, cert.privateKey)

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
  const caCertPath = path.join(options?.basePath || config.basePath, options?.caCertPath || config.caCertPath)

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