import os from 'node:os'
import { CAC } from 'cac'
import { log } from '@stacksjs/logging'
import { version } from '../package.json'
import { addCertToSystemTrustStore, generateCert } from '../src'

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
  .command('secure <domain>', 'Auto generate a self-signed SSL certificate/s')
  .option('--output <output>', 'Output directory', { default: os.tmpdir() })
  .option('--key <key>', 'Output key file name', { default: 'key.pem' })
  .option('--cert <cert>', 'Output certificate file name', { default: 'cert.pem' })
  .option('--ca <ca>', 'Output CA file name', { default: 'ca.pem' })
  .option('--verbose', 'Enable verbose logging', { default: false })
  .usage('tlsx secure <domain> [options]')
  .example('tlsx secure example.com --output /etc/ssl')
  .action(async (domain?: string, options?: Options) => {
    log.debug(`Generating a self-signed SSL certificate for domain: ${domain}`)
    log.debug('Options:', options)
    await addCertToSystemTrustStore((await generateCert()).cert) // TODO: domain
    // Generate a keypair and create an X.509v3 certificate for the domain
    // await generateAndSaveCertificates()
    // await addRootCAToSystemTrust()
  })

cli.version(version)
cli.help()
cli.parse()
