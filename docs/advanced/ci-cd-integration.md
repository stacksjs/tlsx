# CI/CD Integration

This guide covers integrating tlsx into your CI/CD pipelines for automated certificate generation and management.

## Overview

CI/CD integration enables:

- **Automated Testing**: Test with HTTPS in pipelines
- **Consistent Environments**: Same certificates across builds
- **Security Testing**: Verify SSL/TLS handling
- **Deployment Preparation**: Pre-generate production certificates

## GitHub Actions

### Basic Setup

```yaml
# .github/workflows/test.yml
name: Test with HTTPS

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Generate certificates
        run: |
          bunx @stacksjs/tlsx secure app.localhost

      - name: Start server with HTTPS
        run: |
          bun run start &
          sleep 5

      - name: Run tests
        run: bun test
```

### With Certificate Caching

```yaml
name: Test with Cached Certificates

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Cache certificates
        uses: actions/cache@v3
        with:
          path: ~/.stacks/ssl
          key: ${{ runner.os }}-certs-${{ hashFiles('tlsx.config.ts') }}
          restore-keys: |
            ${{ runner.os }}-certs-

      - name: Generate certificates (if not cached)
        run: |
          if [ ! -f ~/.stacks/ssl/app.localhost.crt ]; then
            bunx @stacksjs/tlsx secure app.localhost
          fi

      - name: Run tests
        run: bun test
```

### Multi-Domain Setup

```yaml
name: E2E Tests

on: [push]

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Generate certificates
        run: |
          cat > tlsx.config.ts << 'EOF'
          export default {
            certificates: [
              { domain: 'api.localhost' },
              { domain: 'web.localhost' },
              { domain: 'admin.localhost' },
            ],
          }
          EOF
          bunx @stacksjs/tlsx generate

      - name: Run E2E tests
        run: bun run test:e2e
```

## GitLab CI

### Basic Configuration

```yaml
# .gitlab-ci.yml
stages:
  - test

variables:
  TLSX_CERT_PATH: $CI_PROJECT_DIR/.ssl

test:
  stage: test
  image: oven/bun:latest

  cache:
    key: ${CI_COMMIT_REF_SLUG}-certs
    paths:
      - .ssl/

  script:
    - bun install
    - bunx @stacksjs/tlsx secure app.localhost --cert-path $TLSX_CERT_PATH
    - bun test
```

### With Services

```yaml
test:
  stage: test
  image: oven/bun:latest

  services:
    - name: postgres:15
      alias: db

  before_script:
    - bun install
    - bunx @stacksjs/tlsx secure app.localhost

  script:
    - bun run test:integration
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  test:
    docker:
      - image: oven/bun:latest

    steps:
      - checkout

      - restore_cache:
          keys:
            - certs-{{ checksum "tlsx.config.ts" }}
            - certs-

      - run:
          name: Install dependencies
          command: bun install

      - run:
          name: Generate certificates
          command: bunx @stacksjs/tlsx secure app.localhost

      - save_cache:
          paths:
            - ~/.stacks/ssl
          key: certs-{{ checksum "tlsx.config.ts" }}

      - run:
          name: Run tests
          command: bun test

workflows:
  test:
    jobs:
      - test
```

## Docker Integration

### Dockerfile

```dockerfile
# Dockerfile
FROM oven/bun:latest

WORKDIR /app

# Install tlsx globally
RUN bun add -g @stacksjs/tlsx

# Copy configuration
COPY tlsx.config.ts ./

# Generate certificates at build time
RUN bunx @stacksjs/tlsx secure app.localhost

# Copy application
COPY . .

RUN bun install

CMD ["bun", "run", "start"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    volumes:
      - certs:/app/.ssl
    environment:
      - SSL_CERT=/app/.ssl/app.localhost.crt
      - SSL_KEY=/app/.ssl/app.localhost.key

  cert-generator:
    image: oven/bun:latest
    volumes:
      - certs:/ssl
    command: bunx @stacksjs/tlsx secure app.localhost --cert-path /ssl
    restart: "no"

volumes:
  certs:
```

### Multi-Stage Build

```dockerfile
# Generate certificates in build stage
FROM oven/bun:latest AS cert-builder
RUN bun add -g @stacksjs/tlsx
RUN bunx @stacksjs/tlsx secure app.localhost

# Production image
FROM oven/bun:latest
WORKDIR /app

# Copy certificates from builder
COPY --from=cert-builder /root/.stacks/ssl ./ssl

COPY . .
RUN bun install --production

CMD ["bun", "run", "start"]
```

## Kubernetes

### Certificate Secret

```yaml
# generate-cert-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: generate-certs
spec:
  template:
    spec:
      containers:
        - name: tlsx
          image: oven/bun:latest
          command:
            - sh
            - -c
            - |
              bun add -g @stacksjs/tlsx
              bunx @stacksjs/tlsx secure app.localhost --cert-path /certs
          volumeMounts:
            - name: certs
              mountPath: /certs
      volumes:
        - name: certs
          emptyDir: {}
      restartPolicy: Never
```

### ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tlsx-config
data:
  tlsx.config.ts: |
    export default {
      domain: 'app.example.com',
      validityDays: 365,
      organizationName: 'My Company',
    }
```

## Pre-commit Hooks

### Husky Setup

```bash
# .husky/pre-commit
#!/bin/sh

# Check if certificates need renewal
bunx @stacksjs/tlsx check --quiet

if [ $? -ne 0 ]; then
  echo "Warning: Some certificates need renewal"
  bunx @stacksjs/tlsx renew
fi
```

### Lint-staged

```json
{
  "lint-staged": {
    "tlsx.config.ts": [
      "bunx @stacksjs/tlsx config --validate"
    ]
  }
}
```

## Automated Testing

### Test Configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './test/ssl-setup.ts',
    globalTeardown: './test/ssl-teardown.ts',
  },
})
```

```ts
// test/ssl-setup.ts
import { generateCertificate } from '@stacksjs/tlsx'

export async function setup() {
  await generateCertificate({
    domain: 'test.localhost',
    certPath: './test/ssl/cert.crt',
    keyPath: './test/ssl/key.pem',
  })
}
```

### Playwright with HTTPS

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: 'https://app.localhost:3000',
    ignoreHTTPSErrors: true, // For self-signed certs
  },

  webServer: {
    command: 'bunx @stacksjs/tlsx secure app.localhost && bun run start',
    url: 'https://app.localhost:3000',
    ignoreHTTPSErrors: true,
  },
})
```

## Scheduled Certificate Renewal

### GitHub Actions Scheduled Workflow

```yaml
# .github/workflows/renew-certs.yml
name: Certificate Renewal

on:
  schedule:
    - cron: '0 0 1 * *' # Monthly

jobs:
  renew:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Check and renew certificates
        run: |
          bunx @stacksjs/tlsx check
          bunx @stacksjs/tlsx renew --threshold 30

      - name: Commit renewed certificates
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .ssl/
          git commit -m "chore: renew SSL certificates" || true
          git push
```

## Security Best Practices

### Secret Management

```yaml
# Use secrets for sensitive data
- name: Generate certificates
  env:
    CA_PASSWORD: ${{ secrets.CA_PASSWORD }}
  run: |
    bunx @stacksjs/tlsx secure app.localhost \
      --ca-key ${{ secrets.CA_KEY }}
```

### Artifact Security

```yaml
# Don't upload private keys as artifacts
- uses: actions/upload-artifact@v3
  with:
    name: certificates
    path: |
      .ssl/*.crt
      !.ssl/*.key  # Exclude private keys
```

## Troubleshooting

### Common CI Issues

1. **Permission denied**: Run with sudo or adjust permissions
2. **Certificate not found**: Check path configuration
3. **Cache miss**: Verify cache key matches

### Debug Mode

```yaml
- name: Generate certificates (debug)
  run: |
    bunx @stacksjs/tlsx secure app.localhost --verbose
  env:
    DEBUG: tlsx:*
```

## Next Steps

- [Performance](/advanced/performance) - CI performance optimization
- [Configuration](/advanced/configuration) - Environment-specific config
- [Custom CAs](/advanced/custom-cas) - CA management in CI
