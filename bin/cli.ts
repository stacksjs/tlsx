import crypto from 'node:crypto'
import os from 'node:os'
import { log } from '@stacksjs/logging'
import { CAC } from 'cac'
import { version } from '../package.json'

import { fs } from '@stacksjs/storage'
import {
  CreateRootCA,
  addCertToSystemTrustStoreAndSaveCerts,
  generateCert,
  isCertificateExpired,
  isDomainExists,
} from '../src'
const cli = new CAC('tlsx')

interface Options {
  output: string
  key: string
  cert: string
  ca: string
  verbose: boolean
}

cli
  .command('secure <domain>', 'Auto generate a self-signed SSL certificate/s')
  .option('--output <output>', 'Output directory', { default: os.tmpdir() })
  .option('--key <key>', 'Output key file name', { default: 'key.pem' })
  .option('--cert <cert>', 'Output certificate file name', { default: 'cert.pem' })
  .option('--ca <ca>', 'Output CA file name', { default: 'ca.pem' })
  .option('--verbose', 'Enable verbose logging', { default: false })
  .usage('tlsx secure <domain> [options]')
  .example('tlsx secure example.com --output /etc/ssl')
  .action(async (domain: string, options?: Options) => {
    log.debug(`Generating a self-signed SSL certificate for domain: ${domain}`)
    log.debug('Options:', options)

    const certFilePath = `${os.homedir()}/.stacks/ssl/stacks.localhost.crt`

    // Check if the certificate is expired or domain already exists

    if ((await isCertificateExpired(certFilePath)) || !(await isDomainExists(domain, certFilePath)))
      {
      log.debug(`Start to generate a new certificate for domain: ${domain}`)

      console.log('Start to generate a new certificate for domain:', domain)
      // Create a new Root CA
      const CAcert = await CreateRootCA()

      // await generateCert()
      const HostCert = await generateCert('Tlsx Stacks RootCA', domain, CAcert)

      // await addCertToSystemTrustStoreAndSaveCerts()
      await addCertToSystemTrustStoreAndSaveCerts(HostCert, CAcert.certificate)

      console.log('Certificate generated successfully!')
    } else {
      log.debug('Certificate already exists and is not expired')
      console.log('Certificate already exists and is not expired')
    }
  })

cli.version(version)
cli.help()
cli.parse()
