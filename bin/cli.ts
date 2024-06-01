import os from 'node:os'
import { log } from '@stacksjs/logging'
import { CAC } from 'cac'
import { version } from '../package.json'

import { addCertToSystemTrustStoreAndSaveCerts, createRootCA, generateCert } from '../src'
const cli = new CAC('tlsx')

interface Options {
  domain: string
  output: string
  key: string
  cert: string
  ca: string
  verbose: boolean
}

cli
  .command('secure [domain]', 'Auto generate a self-signed SSL certificate/s')
  .option('-d, --domain [domain]', 'Domain name', { default: true })
  .option('-o, --output <output>', 'Output directory', { default: os.tmpdir() })
  .option('-k, --key <key>', 'Output key file name', { default: 'key.pem' })
  .option('-c, --cert <cert>', 'Output certificate file name', { default: 'cert.pem' })
  .option('-ca, --ca <ca>', 'Output CA file name', { default: 'ca.pem' })
  .option('--verbose', 'Enable verbose logging', { default: false })
  .usage('tlsx secure <domain> [options]')
  .example('tlsx secure example.com --output /etc/ssl')
  .action(async (domain: string, options?: Options) => {
    domain = domain ?? options?.domain

    log.info(`Generating a self-signed SSL certificate for: ${domain}`)
    log.debug('Options:', options)

    const CAcert = await createRootCA()
    const HostCert = await generateCert('Tlsx Stacks RootCA', domain, CAcert)
    await addCertToSystemTrustStoreAndSaveCerts(HostCert, CAcert.certificate)

    log.success('Certificate generated')
  })

cli.version(version)
cli.help()
cli.parse()
