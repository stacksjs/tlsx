import crypto from 'node:crypto'
import forge, { pki, tls } from 'node-forge'
import type { GenerateCertOptions } from './types'

export function generateCert(options?: GenerateCertOptions) {
  const def: GenerateCertOptions = {
    altNameIPs: ['127.0.0.1'],
    altNameURIs: ['localhost'],
    validityDays: 1,
  }

  if (!options)
    options = def

  const keys = pki.rsa.generateKeyPair(2048)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey

  // NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
  // Conforming CAs should ensure serialNumber is:
  // - no more than 20 octets
  // - non-negative (prefix a '00' if your value starts with a '1' bit)
  cert.serialNumber = `01${crypto.randomBytes(19).toString('hex')}` // 1 octet = 8 bits = 1 byte = 2 hex chars
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * (options.validityDays ?? 1))

  const attrs = [{
    name: 'countryName',
    value: 'AU',
  }, {
    shortName: 'ST',
    value: 'Some-State',
  }, {
    name: 'organizationName',
    value: 'Stacks.js, Inc.',
  }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  // add alt names so that the browser won't complain
  cert.setExtensions([{
    name: 'subjectAltName',
    altNames: [
      ...(options.altNameURIs !== undefined
        ? options.altNameURIs.map(uri => ({ type: 6, value: uri }))
        : []
      ),

      ...(options.altNameIPs !== undefined
        ? options.altNameIPs.map(uri => ({ type: 7, ip: uri }))
        : []
      ),
    ],
  }])

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

export { tls, pki, forge }

// export function addCertToSystemTrustStore(cert: string) {
//   // TODO
// }
