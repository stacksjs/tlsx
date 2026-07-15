import { dts } from 'bun-plugin-dtsx'

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

console.log('Built')
