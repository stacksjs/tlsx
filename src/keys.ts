import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { log, runCommand, runCommands } from '@stacksjs/cli'
import forge, { pki, tls } from 'node-forge'
import { resolveConfig } from './config'
import type { GenerateCertOptions } from './types'

export async function generateCert(options?: GenerateCertOptions) {
  log.debug('generateCert', options)

  const opts = await resolveConfig(options)
  const keys = pki.rsa.generateKeyPair(2048)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey

  // NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
  // Conforming CAs should ensure serialNumber is:
  // - no more than 20 octets
  // - non-negative (prefix a '00' if your value starts with a '1' bit)
  cert.serialNumber = `01${crypto.randomBytes(19).toString('hex')}` // 1 octet = 8 bits = 1 byte = 2 hex chars
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * (opts.validityDays ?? 1))

  const attrs = [
    {
      name: 'countryName',
      value: opts.countryName ?? 'US',
    },
    {
      shortName: 'ST',
      value: opts.stateName ?? 'California',
    },
    {
      name: 'organizationName',
      value: opts.organizationName ?? 'tlsx stacks.localhost', // simply for a recognizable name
    },
  ]

  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  // add alt names so that the browser won't complain
  cert.setExtensions([
    {
      name: 'subjectAltName',
      altNames: [
        ...(opts.altNameURIs !== undefined ? opts.altNameURIs.map((uri) => ({ type: 6, value: uri })) : []),

        ...(opts.altNameIPs !== undefined ? opts.altNameIPs.map((uri) => ({ type: 7, ip: uri })) : []),
      ],
    },
  ])

  // self-sign certificate
  cert.sign(keys.privateKey)

  // convert a Forge certificate and private key to PEM
  const pem = pki.certificateToPem(cert)
  const privateKey = pki.privateKeyToPem(keys.privateKey)

  return {
    cert: pem,
    privateKey,
  }
}

export interface AddCertOptions {
  customCertPath?: string
}

export async function addCertToSystemTrustStore(cert: string, options?: AddCertOptions) {
  const certPath = storeCert(cert, options)
  const platform = os.platform()

  if (platform === 'darwin')
    // macOS
    await runCommand(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${certPath}`)
  else if (platform === 'win32')
    // Windows

    await runCommand(`certutil -f -v -addstore -enterprise Root ${certPath}`)
  else if (platform === 'linux')
    // Linux (This might vary based on the distro)
    // for Ubuntu/Debian based systems
    await runCommands([`sudo cp ${certPath} /usr/local/share/ca-certificates/`, `sudo update-ca-certificates`])
  else throw new Error(`Unsupported platform: ${platform}`)
  return certPath
}

export function storeCert(cert: string, options?: AddCertOptions) {
  // Construct the path using os.homedir() and path.join()
  const certPath = options?.customCertPath || path.join(os.homedir(), '.stacks', 'ssl', `stacks.localhost.crt`)

  // Ensure the directory exists before writing the file
  const certDir = path.dirname(certPath)
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true })

  fs.writeFileSync(certPath, cert)

  return certPath
}

export { tls, pki, forge }
