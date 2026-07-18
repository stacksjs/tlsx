import { dts } from 'bun-plugin-dtsx'
import { smokeEntry } from '../../scripts/smoke-entry'

console.log('Building...')

await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  minify: true,
  splitting: true,
  plugins: [dts()],
})

// Ensure the bin is directly executable (npm marks it executable when it
// begins with a shebang; Bun's bundler does not emit one).
const cliPath = './dist/bin/cli.js'
const cli = await Bun.file(cliPath).text()
if (!cli.startsWith('#!'))
  await Bun.write(cliPath, `#!/usr/bin/env node\n${cli}`)

// Post-build smoke check: the published entry must actually link and expose
// the expected exports — a broken facade must fail this build before publish.
// (v0.13.10–v0.13.12 shipped an entry that built fine but could not be imported.)
await smokeEntry('./dist/src/index.js', [
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

console.log('Built')
