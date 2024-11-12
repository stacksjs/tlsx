import os from 'node:os'
import { log } from '@stacksjs/cli'
import { CAC } from 'cac'
import { version } from '../package.json'
import { addCertToSystemTrustStoreAndSaveCerts, createRootCA, generateCert } from '../src/certificate'
import { config } from '../src/config'

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
  .option('-d, --domain [domain]', 'Domain name', { default: 'localhost' })
  .option('-o, --output <output>', 'Output directory', { default: os.tmpdir() })
  .option('-k, --key <key>', 'Output key file name', { default: 'key.pem' })
  .option('-c, --cert <cert>', 'Output certificate file name', { default: 'cert.pem' })
  .option('-ca, --ca <ca>', 'Output CA file name', { default: 'ca.pem' })
  .option('--verbose', 'Enable verbose logging', { default: false })
  .usage('tlsx secure <domain> [options]')
  .example('tlsx secure example.com --output /etc/ssl')
  .action(async (domain: string, options?: Options) => {
    domain = domain ?? config?.altNameURIs[0]

    log.info(`Generating a self-signed SSL certificate for: ${domain}`)
    log.debug('Options:', options)

    const caCert = await createRootCA()
    const hostCert = await generateCert({
      hostCertCN: config?.commonName ?? domain,
      domain,
      rootCAObject: {
        certificate: caCert.certificate,
        privateKey: caCert.privateKey,
      },
    })

    await addCertToSystemTrustStoreAndSaveCerts(hostCert, caCert.certificate)

    log.success('Certificate generated')
  })

cli.version(version)
cli.help()
cli.parse()
