import { CAC } from 'cac'
import { consola as log } from 'consola'
import os from 'node:os'
import { version } from '../package.json'
import { addCertToSystemTrustStoreAndSaveCert, createRootCA, generateCertificate, removeCertFromSystemTrustStore } from '../src/certificate'
import { validateCertificate } from '../src/certificate/validation'
import { config } from '../src/config'
import { listCertsInDirectory, normalizeCertPaths } from '../src/utils'

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

cli
  .command('revoke [domain]', 'Revoke a certificate for a domain')
  .option('-ca, --ca-path <ca>', 'CA file path', { default: config.caCertPath })
  .option('-c, --cert-path <cert>', 'Certificate file path', { default: config.certPath })
  .option('-k, --key-path <key>', 'Key file path', { default: config.keyPath })
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .usage('tlsx revoke [domain] [options]')
  .example('tlsx revoke example.com')
  .example('tlsx revoke example.com --ca-path /path/to/ca.crt')
  .action(async (domain?: string, options?: Omit<CliOptions, 'domains'>) => {
    const cliOptions = options || {}

    // Validate that domain is provided
    if (!domain && !config.domain) {
      throw new Error('No domain specified. Please provide a domain to revoke.')
    }

    const domainToRevoke = domain || config.domain

    log.info(`Revoking certificate for domain: ${domainToRevoke}`)
    log.debug('Options:', { ...cliOptions, domain: domainToRevoke })

    try {
      // Call the implemented certificate revocation function
      await removeCertFromSystemTrustStore(domainToRevoke, {
        caCertPath: cliOptions.caCertPath || config.caCertPath,
        certPath: cliOptions.certPath || config.certPath,
        keyPath: cliOptions.keyPath || config.keyPath,
        verbose: cliOptions.verbose,
      })

      log.success(`Certificate for ${domainToRevoke} has been revoked`)
    } catch (error) {
      log.error(`Failed to revoke certificate for ${domainToRevoke}: ${error}`)
      process.exit(1)
    }
  })

cli
  .command('list', 'List all certificates')
  .option('-d, --dir <directory>', 'Directory to search for certificates')
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .usage('tlsx list [options]')
  .example('tlsx list')
  .example('tlsx list -d /etc/ssl/certs')
  .action(async (options?: { dir?: string, verbose?: boolean }) => {
    const dirPath = options?.dir

    log.info(`Listing certificates${dirPath ? ` in ${dirPath}` : ''}`)

    try {
      const certificates = listCertsInDirectory(dirPath)

      if (certificates.length === 0) {
        log.info('No certificates found')
        return
      }

      log.info(`Found ${certificates.length} certificates:`)
      certificates.forEach((certPath, index) => {
        log.info(`${index + 1}. ${certPath}`)
      })
    } catch (error) {
      log.error(`Failed to list certificates: ${error}`)
      process.exit(1)
    }
  })

cli
  .command('verify [cert-path]', 'Verify a certificate')
  .option('-ca, --ca-path <ca>', 'CA certificate path to verify against', { default: config.caCertPath })
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .usage('tlsx verify [cert-path] [options]')
  .example('tlsx verify /path/to/cert.crt')
  .example('tlsx verify /path/to/cert.crt --ca-path /path/to/ca.crt')
  .action(async (certPath?: string, options?: { 'ca-path'?: string, verbose?: boolean }) => {
    // If no certificate path is provided, use the default
    const certificatePath = certPath || config.certPath
    const caCertPath = options?.['ca-path'] || config.caCertPath
    const verbose = options?.verbose || config.verbose

    log.info(`Verifying certificate: ${certificatePath}`)
    if (caCertPath) {
      log.info(`Against CA certificate: ${caCertPath}`)
    }

    try {
      const result = validateCertificate(certificatePath, caCertPath, verbose)

      if (result.message) {
        log.error(result.message)
        process.exit(1)
      }

      log.info('Certificate details:')
      log.info(`Subject: ${result.subject}`)
      log.info(`Issuer: ${result.issuer}`)
      log.info(`Valid from: ${result.validFrom.toLocaleString()}`)
      log.info(`Valid to: ${result.validTo.toLocaleString()}`)
      log.info(`Domains: ${result.domains.join(', ')}`)

      if (result.valid) {
        log.success('Certificate is valid')
      }
      else {
        log.error('Certificate is invalid:')
        if (result.expired) {
          log.error('- Certificate has expired')
        }
        if (result.notYetValid) {
          log.error('- Certificate is not yet valid')
        }
        if (!result.issuerValid && caCertPath) {
          log.error('- Certificate was not issued by the provided CA')
        }
        process.exit(1)
      }
    }
    catch (error) {
      log.error(`Failed to verify certificate: ${error}`)
      process.exit(1)
    }
  })

cli
  .command('info', 'Display system configuration and paths')
  .option('--verbose', 'Enable verbose logging', { default: config.verbose })
  .usage('tlsx info [options]')
  .example('tlsx info')
  .example('tlsx info --verbose')
  .action(async (options?: { verbose?: boolean }) => {
    const verbose = options?.verbose || config.verbose

    log.info('TLSX Configuration:')
    log.info('==================')

    // System info
    log.info(`\nSystem Information:`)
    log.info(`Platform: ${os.platform()}`)
    log.info(`Architecture: ${os.arch()}`)
    log.info(`OS Version: ${os.version()}`)
    log.info(`Hostname: ${os.hostname()}`)

    // Normalized paths
    const { certPath, keyPath, caCertPath, basePath } = normalizeCertPaths({})

    // Certificate info
    log.info(`\nCertificate Configuration:`)
    log.info(`Domain: ${config.domain}`)
    log.info(`Common Name: ${config.commonName}`)
    log.info(`Organization: ${config.organizationName}`)
    log.info(`Country: ${config.countryName}`)
    log.info(`State: ${config.stateName}`)
    log.info(`Locality: ${config.localityName}`)
    log.info(`Validity Days: ${config.validityDays}`)

    // Path info
    log.info(`\nFile Paths:`)
    log.info(`Base Path: ${basePath}`)
    log.info(`Certificate Path: ${certPath}`)
    log.info(`Private Key Path: ${keyPath}`)
    log.info(`CA Certificate Path: ${caCertPath}`)

    // Additional domains
    log.info(`\nAlternative Names:`)
    log.info(`Alternative IPs: ${config.altNameIPs.join(', ')}`)
    log.info(`Alternative URIs: ${config.altNameURIs.join(', ')}`)

    if (verbose) {
      // Display all config
      log.info(`\nComplete Configuration:`)
      log.info(JSON.stringify(config, null, 2))
    }
  })

cli.version(version)
cli.help()
cli.parse()
