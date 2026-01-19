# Advanced Configuration

This guide covers advanced configuration options for tlsx, including environment-specific settings, programmatic configuration, and optimization strategies.

## Configuration File

tlsx looks for configuration files in this order:

1. `tlsx.config.ts` (TypeScript)
2. `tlsx.config.js` (JavaScript)
3. `tls.config.ts` (TypeScript, legacy)
4. `tls.config.js` (JavaScript, legacy)

## Complete Configuration Reference

```ts
// tlsx.config.ts
import type { TlsConfig } from '@stacksjs/tlsx'
import os from 'node:os'
import path from 'node:path'

const config: TlsConfig = {
  // Certificate Identity
  domain: 'example.localhost',
  hostCertCN: 'example.localhost',
  commonName: 'example.localhost',

  // File Paths
  caCertPath: path.join(os.homedir(), '.stacks', 'ssl', 'ca.crt'),
  certPath: path.join(os.homedir(), '.stacks', 'ssl', 'cert.crt'),
  keyPath: path.join(os.homedir(), '.stacks', 'ssl', 'key.pem'),

  // Subject Alternative Names
  altNameIPs: ['127.0.0.1', '::1'],
  altNameURIs: ['localhost'],

  // Certificate Metadata
  organizationName: 'My Company',
  organizationalUnitName: 'Development',
  countryName: 'US',
  stateName: 'California',
  localityName: 'San Francisco',

  // Validity
  validityDays: 365,

  // Key Options
  keySize: 2048,

  // Trust Store
  trust: true,

  // Logging
  verbose: false,
} satisfies TlsConfig

export default config
```

## Configuration Options

### Certificate Identity

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | string | `'stacks.localhost'` | Primary domain name |
| `hostCertCN` | string | Same as domain | Host certificate Common Name |
| `commonName` | string | Same as domain | Certificate Common Name |
| `domains` | string[] | - | Additional domains (SANs) |

### File Paths

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `caCertPath` | string | `~/.stacks/ssl/ca.crt` | CA certificate path |
| `certPath` | string | `~/.stacks/ssl/cert.crt` | Host certificate path |
| `keyPath` | string | `~/.stacks/ssl/key.pem` | Private key path |

### Subject Alternative Names

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `altNameIPs` | string[] | `['127.0.0.1']` | IP addresses |
| `altNameURIs` | string[] | `['localhost']` | Additional domain names |

### Certificate Metadata

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `organizationName` | string | `'stacksjs.org'` | Organization name |
| `organizationalUnitName` | string | - | Department/unit |
| `countryName` | string | `'US'` | Country code (2 letters) |
| `stateName` | string | `'California'` | State or province |
| `localityName` | string | `'Playa Vista'` | City name |

### Validity and Key Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validityDays` | number | `180` | Certificate validity |
| `keySize` | number | `2048` | RSA key size in bits |

## Environment Variables

Configure tlsx with environment variables:

```bash
TLSX_DOMAIN=example.localhost
TLSX_VALIDITY_DAYS=365
TLSX_VERBOSE=true
TLSX_CERT_PATH=./certs/cert.crt
TLSX_KEY_PATH=./certs/key.pem
TLSX_CA_CERT_PATH=./certs/ca.crt
```

## Environment-Specific Configuration

### Multiple Environments

```ts
// tlsx.config.ts
const env = process.env.NODE_ENV || 'development'

const configs = {
  development: {
    domain: 'dev.localhost',
    validityDays: 90,
    verbose: true,
  },
  staging: {
    domain: 'staging.example.com',
    validityDays: 30,
    verbose: false,
  },
  test: {
    domain: 'test.localhost',
    validityDays: 7,
    verbose: false,
  },
}

export default configs[env]
```

### Conditional Configuration

```ts
// tlsx.config.ts
import os from 'node:os'

const isCI = process.env.CI === 'true'

export default {
  domain: 'example.localhost',
  validityDays: isCI ? 1 : 365,
  trust: !isCI, // Don't trust in CI
  verbose: !isCI,
  certPath: isCI
    ? './tmp/cert.crt'
    : `${os.homedir()}/.stacks/ssl/cert.crt`,
}
```

## Programmatic Configuration

### Dynamic Configuration

```ts
import { generateCertificate, loadConfig } from '@stacksjs/tlsx'

async function main() {
  // Load from file
  const fileConfig = await loadConfig()

  // Override with dynamic values
  const config = {
    ...fileConfig,
    domain: process.argv[2] || fileConfig.domain,
    validityDays: parseInt(process.env.VALIDITY) || fileConfig.validityDays,
  }

  await generateCertificate(config)
}
```

### Factory Functions

```ts
// cert-factory.ts
import type { TlsConfig } from '@stacksjs/tlsx'

export function createCertConfig(
  domain: string,
  options: Partial<TlsConfig> = {},
): TlsConfig {
  return {
    domain,
    hostCertCN: domain,
    commonName: domain,
    validityDays: 365,
    organizationName: 'My Company',
    ...options,
  }
}

// Usage
const config = createCertConfig('api.localhost', {
  validityDays: 180,
})
```

### Validation

```ts
import { validateConfig, generateCertificate } from '@stacksjs/tlsx'

const config = {
  domain: 'example.localhost',
  validityDays: 365,
}

// Validate before generating
const errors = validateConfig(config)
if (errors.length > 0) {
  console.error('Invalid configuration:', errors)
  process.exit(1)
}

await generateCertificate(config)
```

## Multi-Domain Configuration

### Workspace Configuration

```ts
// tlsx.config.ts
const services = ['api', 'web', 'admin', 'docs']

export default {
  // Shared CA for all services
  sharedCA: true,
  caCertPath: '~/.stacks/ssl/workspace-ca.crt',

  // Generate certificates for all services
  certificates: services.map((service) => ({
    domain: `${service}.localhost`,
    certPath: `./certs/${service}.crt`,
    keyPath: `./certs/${service}.key`,
  })),
}
```

### Monorepo Setup

```ts
// tlsx.config.ts
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const packagesDir = './packages'
const packages = readdirSync(packagesDir)

export default {
  certificates: packages.map((pkg) => ({
    domain: `${pkg}.localhost`,
    certPath: join(packagesDir, pkg, 'ssl', 'cert.crt'),
    keyPath: join(packagesDir, pkg, 'ssl', 'key.pem'),
  })),
}
```

## Key Configuration

### Key Size

```ts
export default {
  domain: 'example.localhost',
  keySize: 4096, // Stronger but slower
}
```

Recommended key sizes:
- **2048**: Standard, good balance
- **3072**: Enhanced security
- **4096**: Maximum security (slower)

### Key Algorithm

```ts
export default {
  domain: 'example.localhost',
  keyAlgorithm: 'RSA', // or 'ECDSA'
  ecCurve: 'P-256', // for ECDSA
}
```

## Logging Configuration

### Verbose Mode

```ts
export default {
  domain: 'example.localhost',
  verbose: true, // Enable detailed logging
}
```

### Custom Logger

```ts
import { generateCertificate } from '@stacksjs/tlsx'

await generateCertificate({
  domain: 'example.localhost',
  logger: {
    info: (msg) => console.log(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    debug: (msg) => console.debug(`[DEBUG] ${msg}`),
  },
})
```

## Performance Configuration

### Caching

```ts
export default {
  domain: 'example.localhost',

  cache: {
    enabled: true,
    dir: '~/.stacks/ssl/cache',
    ttl: 86400, // 24 hours
  },
}
```

### Parallel Generation

```ts
import { generateCertificate } from '@stacksjs/tlsx'

const domains = ['api.localhost', 'web.localhost', 'admin.localhost']

// Generate certificates in parallel
const certs = await Promise.all(
  domains.map((domain) =>
    generateCertificate({
      domain,
      validityDays: 365,
    }),
  ),
)
```

## Security Configuration

### Strict Mode

```ts
export default {
  domain: 'example.localhost',

  security: {
    minKeySize: 2048,
    maxValidityDays: 397, // ~13 months
    requireOrganization: true,
  },
}
```

### Permissions

```ts
export default {
  domain: 'example.localhost',

  permissions: {
    certMode: 0o644, // rw-r--r--
    keyMode: 0o600, // rw-------
    dirMode: 0o755, // rwxr-xr-x
  },
}
```

## Troubleshooting

### Debug Configuration

```bash
# Show resolved configuration
tlsx config --print

# Validate configuration
tlsx config --validate

# Verbose output
tlsx secure example.localhost --verbose
```

### Common Issues

1. **Path not found**: Ensure directories exist
2. **Permission denied**: Check file permissions
3. **Invalid domain**: Verify domain format

## Next Steps

- [Custom CAs](/advanced/custom-cas) - Advanced CA configuration
- [Performance](/advanced/performance) - Optimization strategies
- [CI/CD Integration](/advanced/ci-cd-integration) - Pipeline automation
