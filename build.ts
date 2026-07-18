import { dts } from 'bun-plugin-dtsx'
import { smokeEntry } from './scripts/smoke-entry'

// eslint-disable-next-line ts/no-top-level-await
await Bun.build({
  entrypoints: ['packages/tlsx/src/index.ts'],
  outdir: './dist',
  target: 'node',
  plugins: [dts({
    root: 'packages/tlsx/src',
    outdir: './dist',
  } as any)],
})

// Post-build smoke check: the built entry must link and expose the expected
// exports (guards the facade-desync class that broke v0.13.10–v0.13.12).
// eslint-disable-next-line ts/no-top-level-await
await smokeEntry('./dist/index.js', [
  'config',
  'defaultConfig',
  'getConfig',
  'obtainCertificate',
  'AcmeClient',
  'fetchWithTimeout',
  'DEFAULT_REQUEST_TIMEOUT_MS',
  'generateCertificate',
  'createRootCA',
  'installCA',
  'storeCertificate',
  'validateCertificate',
  'Http01Store',
  'PorkbunDnsProvider',
])
