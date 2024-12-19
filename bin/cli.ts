import { CAC } from 'cac'
import { consola as log } from 'consola'
import { version } from '../package.json'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCertificate } from '../src/certificate'
import { config } from '../src/config'

interface CliOptions {
  keyPath?: string
  certPath?: string
  caCertPath?: string
  domains?: string // Comma-separated string for CLI
  altNameIPs?: string // Comma-separated string for CLI
  altNameURIs?: string // Comma-separated string for CLI
  commonName?: string
  countryName?: string
  stateName?: string
  localityName?: string
  organizationName?: string
  validityDays?: string | number
  verbose?: boolean
}

const cli = new CAC('tlsx')

cli
  .command('secure [domain]', 'Auto generate a self-signed SSL certificate for one or multiple domains')
  .option('-k, --key-path <key>', 'Output key file name', { default: config.keyPath })
  .option('-c, --cert-path <cert>', 'Output certificate file name', { default: config.certPath })
  .option('-ca, --ca-path <ca>', 'Output CA file name', { default: config.caCertPath })
  .option('-d, --domains <domains>', 'Additional domains (comma-separated)')
  .option('--alt-name-ips <ips>', 'Alternative Name IPs (comma-separated)', { default: config.altNameIPs.join(',') })
  .option('--alt-name-uris <uris>', 'Alternative Name URIs (comma-separated)', { default: config.altNameURIs.join(',') })
  .option('--common-name <name>', 'Common Name for the certificate', { default: config.commonName })
  .option('--country-name <name>', 'Country Name for the certificate', { default: config.countryName })
  .option('--state-name <name>', 'State Name for the certificate', { default: config.stateName })
  .option('--locality-name <name>', 'Locality Name for the certificate', { default: config.localityName })
  .option('--organization-name <name>', 'Organization Name for the certificate', { default: config.organizationName })
  .option('--validity-days <days>', 'Validity Days for the certificate', { default: config.validityDays })
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .usage('tlsx secure [domain] [options]')
  .example('tlsx secure example.com --output /etc/ssl')
  .example('tlsx secure example.com -d "api.example.com,*.example.com"')
  .example('tlsx secure -d "example.com,api.example.com"')
  .example('tlsx secure stacks.localhost -d "stacks2.local,stacks3.localhost,stacks4.test"')
  .action(async (domain?: string, options?: CliOptions) => {
    const cliOptions = options || {}

    // Handle domains from both argument and option
    const domains: string[] = []

    // Add domain argument if provided
    if (domain) {
      domains.push(domain)
    }

    // Add domains from -d option if provided
    if (cliOptions.domains) {
      domains.push(...cliOptions.domains.split(',').map(d => d.trim()))
    }

    // Add domain from config if no domains specified
    if (domains.length === 0 && config?.domain) {
      domains.push(config.domain)
    }

    // Validate that we have at least one domain
    if (domains.length === 0) {
      throw new Error('No domains specified. Use either positional argument or --domains option')
    }

    // Parse IP addresses
    const altNameIPs = cliOptions.altNameIPs
      ? cliOptions.altNameIPs.split(',').map(ip => ip.trim())
      : config.altNameIPs

    // Parse URIs
    const altNameURIs = cliOptions.altNameURIs
      ? cliOptions.altNameURIs.split(',').map(uri => uri.trim())
      : config.altNameURIs

    log.info(`Generating a self-signed SSL certificate for: ${domains.join(', ')}`)
    log.debug('Options:', { ...cliOptions, domains })

    const caCert = await createRootCA()
    const hostCert = await generateCertificate({
      domain: domains[0], // Use first domain as primary if needed
      domains,
      commonName: cliOptions.commonName ?? config.commonName ?? domains[0],
      altNameIPs,
      altNameURIs,
      countryName: cliOptions.countryName || config.countryName,
      stateName: cliOptions.stateName || config.stateName,
      localityName: cliOptions.localityName || config.localityName,
      organizationName: cliOptions.organizationName || config.organizationName,
      validityDays: Number(cliOptions.validityDays) || config.validityDays,
      rootCA: {
        certificate: caCert.certificate,
        privateKey: caCert.privateKey,
      },
    })

    await addCertToSystemTrustStoreAndSaveCert(hostCert, caCert.certificate)

    log.success('Certificate generated successfully')
  })

cli.version(version)
cli.help()
cli.parse()
