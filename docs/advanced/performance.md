# Performance

This guide covers performance optimization strategies for tlsx, including caching, parallel generation, and benchmarking.

## Performance Characteristics

tlsx is optimized for:

- **Fast generation**: ~50-100ms per certificate
- **Low memory**: ~20MB peak usage
- **Efficient storage**: Minimal disk I/O

## Certificate Generation Performance

### Key Size Impact

| Key Size | Generation Time | Security Level |
|----------|-----------------|----------------|
| 2048-bit | ~50ms | Standard |
| 3072-bit | ~150ms | Enhanced |
| 4096-bit | ~500ms | Maximum |

### Recommended Settings

```ts
// Development (fast)
const devCert = await generateCertificate({
  domain: 'app.localhost',
  keySize: 2048,
  validityDays: 90,
})

// Production-like (secure)
const prodCert = await generateCertificate({
  domain: 'app.example.com',
  keySize: 4096,
  validityDays: 365,
})
```

## Caching

### Certificate Caching

Cache generated certificates to avoid regeneration:

```ts
// tlsx.config.ts
export default {
  cache: {
    enabled: true,
    dir: '~/.stacks/ssl/cache',
    ttl: 86400 * 30, // 30 days
  },
}
```

### Programmatic Caching

```ts
import { generateCertificate, getCachedCertificate, cacheCertificate } from '@stacksjs/tlsx'

async function getCertificate(domain: string) {
  // Check cache first
  const cached = await getCachedCertificate(domain)
  if (cached && !cached.isExpired) {
    return cached
  }

  // Generate new certificate
  const cert = await generateCertificate({ domain })

  // Cache for future use
  await cacheCertificate(domain, cert)

  return cert
}
```

### Cache Invalidation

```bash
# Clear all cached certificates
tlsx cache clear

# Clear specific domain
tlsx cache clear app.localhost
```

## Parallel Generation

### Batch Certificate Generation

```ts
import { generateCertificate, createRootCA } from '@stacksjs/tlsx'

const domains = [
  'api.localhost',
  'web.localhost',
  'admin.localhost',
  'docs.localhost',
]

// Create shared CA once
const ca = await createRootCA({
  commonName: 'Batch CA',
})

// Generate certificates in parallel
const startTime = performance.now()

const certificates = await Promise.all(
  domains.map((domain) =>
    generateCertificate({
      domain,
      rootCA: ca,
      validityDays: 365,
    }),
  ),
)

const duration = performance.now() - startTime
console.log(`Generated ${domains.length} certificates in ${duration}ms`)
// Generated 4 certificates in ~200ms
```

### Concurrency Control

```ts
import pLimit from 'p-limit'
import { generateCertificate } from '@stacksjs/tlsx'

const limit = pLimit(4) // Max 4 concurrent generations

const domains = Array.from({ length: 20 }, (_, i) => `app${i}.localhost`)

const certificates = await Promise.all(
  domains.map((domain) =>
    limit(() => generateCertificate({ domain })),
  ),
)
```

## Memory Optimization

### Streaming for Large Operations

```ts
import { generateCertificateStream } from '@stacksjs/tlsx'

// Stream certificate to file instead of buffering
await generateCertificateStream({
  domain: 'app.localhost',
  certStream: fs.createWriteStream('./cert.crt'),
  keyStream: fs.createWriteStream('./key.pem'),
})
```

### Cleanup

```ts
import { cleanup } from '@stacksjs/tlsx'

// Clean up temporary files and memory
await cleanup()
```

## Benchmarking

### Built-in Benchmarks

```bash
# Run performance benchmark
tlsx benchmark

# Output:
# Certificate Generation Benchmark
# ================================
# Key Size: 2048 bits
# Iterations: 100
#
# Results:
#   Min:     45ms
#   Max:     89ms
#   Avg:     52ms
#   P95:     67ms
#   P99:     82ms
```

### Custom Benchmarks

```ts
import { generateCertificate } from '@stacksjs/tlsx'

async function benchmark(iterations: number = 100) {
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()

    await generateCertificate({
      domain: `bench${i}.localhost`,
      keySize: 2048,
    })

    times.push(performance.now() - start)
  }

  // Calculate statistics
  const avg = times.reduce((a, b) => a + b) / times.length
  const sorted = times.sort((a, b) => a - b)
  const p95 = sorted[Math.floor(times.length * 0.95)]
  const p99 = sorted[Math.floor(times.length * 0.99)]

  console.log({
    iterations,
    avgMs: avg.toFixed(2),
    p95Ms: p95.toFixed(2),
    p99Ms: p99.toFixed(2),
    minMs: sorted[0].toFixed(2),
    maxMs: sorted[sorted.length - 1].toFixed(2),
  })
}

await benchmark(100)
```

## Startup Optimization

### Lazy Loading

```ts
// Only load tlsx when needed
let tlsx: typeof import('@stacksjs/tlsx') | null = null

async function getTlsx() {
  if (!tlsx) {
    tlsx = await import('@stacksjs/tlsx')
  }
  return tlsx
}

// Use when needed
const { generateCertificate } = await getTlsx()
```

### Preloading

```ts
// preload.ts - Run at application startup
import '@stacksjs/tlsx' // Preload the module

// main.ts - Module is already cached
import { generateCertificate } from '@stacksjs/tlsx'
```

## CI/CD Performance

### Caching in CI

```yaml
# GitHub Actions
- name: Cache certificates
  uses: actions/cache@v3
  with:
    path: ~/.stacks/ssl
    key: ${{ runner.os }}-certs-${{ hashFiles('tlsx.config.ts') }}

- name: Generate certificates
  run: tlsx secure app.localhost
```

### Parallel Jobs

```yaml
jobs:
  generate-certs:
    strategy:
      matrix:
        domain: [api, web, admin, docs]
    steps:
      - run: tlsx secure ${{ matrix.domain }}.localhost
```

## Monitoring

### Performance Metrics

```ts
import { getMetrics } from '@stacksjs/tlsx'

const metrics = await getMetrics()
console.log(metrics)
// {
//   certificatesGenerated: 150,
//   avgGenerationTime: 52,
//   cacheHits: 120,
//   cacheMisses: 30,
//   memoryUsage: 18500000,
// }
```

### Profiling

```bash
# Enable profiling
NODE_OPTIONS="--prof" tlsx secure app.localhost

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

## Best Practices

### Development

- Use 2048-bit keys for faster generation
- Enable caching to avoid regeneration
- Generate certificates in parallel

### Testing

- Pre-generate certificates before test runs
- Cache certificates between test runs
- Use shorter validity periods

### Production-like

- Use 4096-bit keys for maximum security
- Pre-generate and store certificates
- Implement certificate rotation

## Troubleshooting

### Slow Generation

1. Check key size (reduce to 2048 for development)
2. Enable caching
3. Verify disk I/O is not a bottleneck

### Memory Issues

1. Process certificates in batches
2. Use streaming for large operations
3. Call cleanup() after bulk operations

### CI Timeouts

1. Cache certificates between runs
2. Parallelize generation
3. Use smaller key sizes in CI

## Next Steps

- [CI/CD Integration](/advanced/ci-cd-integration) - Pipeline optimization
- [Configuration](/advanced/configuration) - Performance-related config
- [Custom CAs](/advanced/custom-cas) - Efficient CA management
