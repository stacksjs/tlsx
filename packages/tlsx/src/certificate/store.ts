import fs from 'node:fs'
import path from 'node:path'
import type { Cert, CertPath, TlsOption } from '../types'
import { config } from '../config'
import { debugLog } from '../utils'

/**
 * Store a certificate and its private key
 * @param cert Certificate and private key
 * @param options TLS options
 * @returns Path to the stored certificate
 */
export function storeCertificate(cert: Cert, options?: TlsOption): CertPath {
  debugLog('storage', `Storing certificate and private key with options: ${JSON.stringify(options)}`, options?.verbose)
  const certPath = path.join(options?.basePath || config.basePath, options?.certPath || config.certPath)
  const certKeyPath = path.join(options?.basePath || config.basePath, options?.keyPath || config.keyPath)

  debugLog('storage', `Certificate path: ${certPath}`, options?.verbose)
  debugLog('storage', `Private key path: ${certKeyPath}`, options?.verbose)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) {
    debugLog('storage', `Creating certificate directory: ${certDir}`, options?.verbose)
    fs.mkdirSync(certDir, { recursive: true })
  }

  debugLog('storage', 'Writing certificate file', options?.verbose)
  fs.writeFileSync(certPath, cert.certificate)

  // Ensure the directory exists before writing the file
  const certKeyDir = path.dirname(certKeyPath)
  if (!fs.existsSync(certKeyDir)) {
    debugLog('storage', `Creating private key directory: ${certKeyDir}`, options?.verbose)
    fs.mkdirSync(certKeyDir, { recursive: true })
  }

  debugLog('storage', 'Writing private key file', options?.verbose)
  fs.writeFileSync(certKeyPath, cert.privateKey)

  debugLog('storage', 'Certificate and private key stored successfully', options?.verbose)
  return certPath
}

/**
 * Store the CA Certificate
 * @param caCert - The CA Certificate
 * @param options - The options for storing the CA Certificate
 * @returns The path to the CA Certificate
 */
export function storeCACertificate(caCert: string, options?: TlsOption): CertPath {
  debugLog('storage', 'Storing CA certificate', options?.verbose)
  const caCertPath = path.join(options?.basePath || config.basePath, options?.caCertPath || config.caCertPath)

  debugLog('storage', `CA certificate path: ${caCertPath}`, options?.verbose)

  // Ensure the directory exists before writing the file
  const caCertDir = path.dirname(caCertPath)
  if (!fs.existsSync(caCertDir)) {
    debugLog('storage', `Creating CA certificate directory: ${caCertDir}`, options?.verbose)
    fs.mkdirSync(caCertDir, { recursive: true })
  }

  debugLog('storage', 'Writing CA certificate file', options?.verbose)
  fs.writeFileSync(caCertPath, caCert)

  debugLog('storage', 'CA certificate stored successfully', options?.verbose)
  return caCertPath
}