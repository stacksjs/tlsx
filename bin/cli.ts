import type { TlsOption } from '../src/types'
import { CAC } from 'cac'
import { consola as log } from 'consola'
import { version } from '../package.json'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCertificate } from '../src/certificate'
import { config } from '../src/config'

const cli = new CAC('tlsx')

cli
  .command('secure [domain]', 'Auto generate a self-signed SSL certificate/s')
  .option('-k, --key-path <key>', 'Output key file name', { default: config.keyPath })
  .option('-c, --cert-path <cert>', 'Output certificate file name', { default: config.certPath })
  .option('-ca, --ca-path <ca>', 'Output CA file name', { default: config.caCertPath })
  .option('--alt-name-ips <ips>', 'Alternative Name IPs (comma-separated)', { default: config.altNameIPs.join(',') })
  .option('--alt-name-uris <uris>', 'Alternative Name URIs (comma-separated)', { default: config.altNameURIs.join(',') })
  .option('--common-name <name>', 'Common Name for the certificate', { default: config.commonName })
  .option('--country-name <name>', 'Country Name for the certificate', { default: config.countryName })
  .option('--state-name <name>', 'State Name for the certificate', { default: config.stateName })
  .option('--locality-name <name>', 'Locality Name for the certificate', { default: config.localityName })
  .option('--organization-name <name>', 'Organization Name for the certificate', { default: config.organizationName })
  .option('--validity-days <days>', 'Validity Days for the certificate', { default: config.validityDays })
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .usage('tlsx secure <domain> [options]')
  .example('tlsx secure example.com --output /etc/ssl')
  .action(async (domain: string, options?: TlsOption) => {
    domain = domain || config?.domain

    log.info(`Generating a self-signed SSL certificate for: ${domain}`)
    log.debug('Options:', options)

    const caCert = await createRootCA()
    const hostCert = await generateCertificate({
      hostCertCN: options?.commonName ?? config.commonName ?? domain,
      domain,
      altNameIPs: typeof options?.altNameIPs === 'string' ? (options.altNameIPs as string).split(',') : config.altNameIPs,
      altNameURIs: typeof options?.altNameURIs === 'string' ? (options.altNameURIs as string).split(',') : config.altNameURIs,
      countryName: options?.countryName || config.countryName,
      stateName: options?.stateName || config.stateName,
      localityName: options?.localityName || config.localityName,
      organizationName: options?.organizationName || config.organizationName,
      validityDays: Number(options?.validityDays) || config.validityDays,
      rootCA: {
        certificate: caCert.certificate,
        privateKey: caCert.privateKey,
      },
    })

    await addCertToSystemTrustStoreAndSaveCert(hostCert, caCert.certificate)

    log.success('Certificate generated')
  })

cli.version(version)
cli.help()
cli.parse()
