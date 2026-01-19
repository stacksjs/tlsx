# Auto-Renewal

tlsx can automatically monitor and renew certificates before they expire, ensuring your development environment always has valid SSL certificates.

## Overview

Auto-renewal provides:

- **Expiration Monitoring**: Track certificate expiration dates
- **Automatic Regeneration**: Renew certificates before they expire
- **Trust Store Updates**: Automatically update system trust stores
- **Notifications**: Alert when certificates are renewed

## Basic Usage

### CLI

Check and renew expiring certificates:

```bash
# Check all certificates
tlsx check

# Renew expiring certificates
tlsx renew

# Force renew all certificates
tlsx renew --force
```

### Library

```ts
import { checkCertificates, renewCertificates } from '@stacksjs/tlsx'

// Check certificate status
const status = await checkCertificates()
console.log(status)
// [
//   { domain: 'app.localhost', expiresIn: 45, status: 'valid' },
//   { domain: 'api.localhost', expiresIn: 10, status: 'expiring' },
// ]

// Renew expiring certificates
const renewed = await renewCertificates({
  threshold: 30, // Renew if expiring within 30 days
})
```

## Configuration

### Renewal Threshold

Set when certificates should be renewed:

```ts
// tlsx.config.ts
export default {
  renewal: {
    threshold: 30, // Days before expiration to renew
    autoRenew: true, // Enable automatic renewal
  },
}
```

### Watch Mode

Continuously monitor and renew certificates:

```bash
# CLI
tlsx watch
```

```ts
// Library
import { watchCertificates } from '@stacksjs/tlsx'

const watcher = await watchCertificates({
  interval: 86400000, // Check every 24 hours
  threshold: 30, // Renew 30 days before expiration
  onRenew: (cert) => {
    console.log(`Renewed certificate for ${cert.domain}`)
  },
})

// Stop watching
watcher.stop()
```

## Renewal Strategies

### Threshold-Based Renewal

Renew certificates that will expire within a threshold:

```ts
await renewCertificates({
  threshold: 30, // Days
})
```

### Scheduled Renewal

Renew on a specific schedule:

```ts
import { scheduleRenewal } from '@stacksjs/tlsx'

// Renew every Sunday at 2 AM
scheduleRenewal({
  cron: '0 2 * * 0',
  threshold: 30,
})
```

### On-Demand Renewal

Renew specific certificates:

```bash
# CLI
tlsx renew example.localhost
```

```ts
// Library
await renewCertificate({
  domain: 'example.localhost',
  force: true, // Renew even if not expiring
})
```

## Certificate Status

### Check Status

```bash
# CLI
tlsx check

# Output:
# Domain                  Status      Expires In
# app.localhost           Valid       120 days
# api.localhost           Expiring    15 days
# old.localhost           Expired     -5 days
```

```ts
// Library
const status = await getCertificateStatus('app.localhost')
console.log(status)
// {
//   domain: 'app.localhost',
//   status: 'valid', // 'valid' | 'expiring' | 'expired'
//   validFrom: Date,
//   validTo: Date,
//   daysRemaining: 120,
// }
```

### Status Types

| Status | Description |
|--------|-------------|
| `valid` | Certificate is valid and not expiring soon |
| `expiring` | Certificate will expire within threshold |
| `expired` | Certificate has already expired |

## Hooks and Callbacks

### Renewal Events

```ts
import { watchCertificates } from '@stacksjs/tlsx'

const watcher = await watchCertificates({
  onCheck: (certs) => {
    console.log(`Checked ${certs.length} certificates`)
  },

  onExpiring: (cert) => {
    console.log(`Certificate expiring: ${cert.domain}`)
    // Send notification
  },

  onRenew: (cert) => {
    console.log(`Renewed: ${cert.domain}`)
    // Restart services if needed
  },

  onError: (error) => {
    console.error('Renewal error:', error)
    // Alert on failure
  },
})
```

### Integration with Services

Restart services after renewal:

```ts
import { exec } from 'node:child_process'

const watcher = await watchCertificates({
  onRenew: async (cert) => {
    // Reload nginx
    await exec('nginx -s reload')

    // Or restart your dev server
    await exec('pm2 restart all')
  },
})
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Certificate Renewal

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  renew:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Install tlsx
        run: bun add -g @stacksjs/tlsx

      - name: Check certificates
        run: tlsx check

      - name: Renew if needed
        run: tlsx renew --threshold 30

      - name: Commit renewed certs
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add certs/
          git commit -m "Renew SSL certificates" || true
          git push
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check certificate status
tlsx check --quiet

# Fail if any certificates are expired
if [ $? -ne 0 ]; then
  echo "Error: Some certificates have expired. Run 'tlsx renew' first."
  exit 1
fi
```

## Notifications

### Email Notifications

```ts
import { watchCertificates } from '@stacksjs/tlsx'
import { sendEmail } from './email'

watchCertificates({
  onExpiring: async (cert) => {
    await sendEmail({
      to: 'admin@example.com',
      subject: `Certificate expiring: ${cert.domain}`,
      body: `Certificate for ${cert.domain} expires in ${cert.daysRemaining} days.`,
    })
  },
})
```

### Slack Notifications

```ts
import { watchCertificates } from '@stacksjs/tlsx'

watchCertificates({
  onRenew: async (cert) => {
    await fetch(process.env.SLACK_WEBHOOK, {
      method: 'POST',
      body: JSON.stringify({
        text: `Certificate renewed for ${cert.domain}`,
      }),
    })
  },
})
```

## Best Practices

### Renewal Threshold

- **Development**: 30 days (monthly renewal)
- **Staging**: 14 days (bi-weekly check)
- **Testing**: 7 days (weekly renewal)

### Monitoring

- Set up alerts for expiring certificates
- Monitor renewal success/failure
- Keep logs of renewal history

### Backup

- Backup certificates before renewal
- Keep previous versions available
- Document certificate history

## Troubleshooting

### Renewal Fails

1. Check if the CA certificate is still valid
2. Verify write permissions to certificate directories
3. Check system trust store permissions

### Certificate Not Trusted After Renewal

1. Re-add to system trust store
2. Restart applications using the certificate
3. Clear browser cache

## Next Steps

- [Root CA](/features/root-ca) - Managing Certificate Authorities
- [Trust Store](/features/trust-store-management) - System trust store management
- [Configuration](/advanced/configuration) - Advanced configuration options
