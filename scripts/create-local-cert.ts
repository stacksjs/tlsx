#!/usr/bin/env bun

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  addCertToSystemTrustStoreAndSaveCert,
  createRootCA,
  generateCertificate,
  validateBrowserCompatibility,
  validateCertificate,
} from '../packages/tlsx/src/certificate'

async function main() {
  try {
    console.log('🔐 Creating trusted certificate for localhost:5173...')

    // Define the domain and certificate options
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
    if (fs.existsSync(caCertPath) && fs.existsSync(path.join(basePath, `${domain}-ca.key`))) {
      console.log('📄 Using existing Root CA certificate')
      const caCert = fs.readFileSync(caCertPath, 'utf8')
      const caKeyPath = path.join(basePath, `${domain}-ca.key`)
      const caKey = fs.readFileSync(caKeyPath, 'utf8')
      rootCA = { certificate: caCert, privateKey: caKey }
    }
    else {
      console.log('🔑 Creating new Root CA certificate')
      // Create a new root CA with stronger settings for browser compatibility
      rootCA = await createRootCA({
        commonName: 'Local Development Root CA',
        organization: 'Local Development',
        organizationalUnit: 'Development',
        countryName: 'US',
        stateName: 'California',
        localityName: 'Playa Vista',
        validityYears: 10,
        keySize: 4096, // Stronger key for better browser compatibility
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
      validityDays: 397, // Just under 398 days for browser compatibility
      rootCA,
      // Add key usage for better browser compatibility
      keyUsage: {
        digitalSignature: true,
        keyEncipherment: true,
        keyAgreement: false,
        dataEncipherment: false,
        contentCommitment: false,
        keyCertSign: false,
        cRLSign: false,
        encipherOnly: false,
        decipherOnly: false,
      },
      // Add extended key usage for better browser compatibility
      extKeyUsage: {
        serverAuth: true,
        clientAuth: true,
        codeSigning: false,
        emailProtection: false,
        timeStamping: false,
      },
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

    // Validate the certificate
    console.log('🔍 Validating certificate...')
    const validationResult = validateCertificate(certPath, caCertPath, true)
    if (validationResult.valid) {
      console.log('✅ Certificate is valid!')
    }
    else {
      console.warn('⚠️ Certificate validation issues:')
      console.warn(`   - Valid: ${validationResult.valid}`)
      console.warn(`   - Expired: ${validationResult.expired}`)
      console.warn(`   - Not yet valid: ${validationResult.notYetValid}`)
      console.warn(`   - Issuer valid: ${validationResult.issuerValid}`)
      console.warn(`   - Message: ${validationResult.message || 'No specific issues'}`)
    }

    // Check browser compatibility
    const compatibilityResult = validateBrowserCompatibility(certPath, true)
    if (compatibilityResult.compatible) {
      console.log('✅ Certificate is compatible with modern browsers')
    }
    else {
      console.warn('⚠️ Browser compatibility issues:')
      for (const issue of compatibilityResult.issues) {
        console.warn(`   - ${issue}`)
      }
    }

    console.log('✅ Certificate successfully created and trusted!')
    console.log(`
Certificate information:
- Domain: ${domain}
- Port: ${port}
- Certificate path: ${certPath}
- Private key path: ${keyPath}
- CA certificate path: ${caCertPath}

You can now use https://localhost:5173 or https://127.0.0.1:5173 for local development!

If you're still seeing certificate errors in Chrome/Arc:
1. Click anywhere on the error page and type: thisisunsafe
2. This will bypass the warning for the current browsing session
`)
  }
  catch (error) {
    console.error('❌ Error creating certificate:', error)
    process.exit(1)
  }
}

main()
