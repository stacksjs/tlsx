#!/usr/bin/env bun
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { createRootCA, generateCertificate, addCertToSystemTrustStoreAndSaveCert } from '../packages/tlsx/src'

async function main() {
  try {
    console.log('🔐 Creating trusted certificate for localhost:5173...')

    // Define the domain
    const domain = 'localhost'
    const port = 5173

    // Set paths for storing certificates
    const basePath = path.join(os.homedir(), '.tlsx', 'ssl')
    const caCertPath = path.join(basePath, `${domain}-ca.crt`)
    const certPath = path.join(basePath, `${domain}.crt`)
    const keyPath = path.join(basePath, `${domain}.key`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true })
    }

    // Check if CA certificate already exists
    let rootCA
    if (fs.existsSync(caCertPath)) {
      console.log('📄 Using existing Root CA certificate')
      const caCert = fs.readFileSync(caCertPath, 'utf8')
      const caKeyPath = path.join(basePath, `${domain}-ca.key`)
      const caKey = fs.readFileSync(caKeyPath, 'utf8')
      rootCA = { certificate: caCert, privateKey: caKey }
    } else {
      console.log('🔑 Creating new Root CA certificate')
      // Create a new root CA
      rootCA = await createRootCA({
        commonName: 'Local Development Root CA',
        organization: 'Local Development',
        organizationalUnit: 'Development',
        countryName: 'US',
        stateName: 'California',
        localityName: 'Playa Vista',
        validityYears: 10,
        verbose: true,
      })

      // Save the CA certificate and key
      fs.writeFileSync(caCertPath, rootCA.certificate)
      fs.writeFileSync(path.join(basePath, `${domain}-ca.key`), rootCA.privateKey)
    }

    // Generate the certificate for localhost:5173
    console.log(`🔒 Generating certificate for ${domain}:${port}`)
    const cert = await generateCertificate({
      domain,
      // Include both localhost and 127.0.0.1 as domain names
      domains: [`${domain}`, '127.0.0.1'],
      // Include IP addresses in the certificate
      altNameIPs: ['127.0.0.1', '::1'],
      // Include localhost as a URI
      altNameURIs: ['localhost'],
      commonName: domain,
      organizationName: 'Local Development',
      countryName: 'US',
      stateName: 'California',
      localityName: 'Playa Vista',
      validityDays: 825, // ~2 years + buffer
      rootCA,
      verbose: true,
    })

    // Add the certificate to the system trust store
    console.log('🔐 Adding certificate to system trust store')
    await addCertToSystemTrustStoreAndSaveCert(cert, rootCA.certificate, {
      basePath,
      certPath,
      keyPath,
      caCertPath,
      verbose: true,
    })

    console.log('✅ Certificate successfully created and trusted!')
    console.log(`
Certificate information:
- Domain: ${domain}
- Port: ${port}
- Certificate path: ${certPath}
- Private key path: ${keyPath}
- CA certificate path: ${caCertPath}

You can now use https://localhost:5173 for local development!
`)
  }
  catch (error) {
    console.error('❌ Error creating certificate:', error)
    process.exit(1)
  }
}

main()