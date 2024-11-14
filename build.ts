import { $ } from 'bun'
import process from 'node:process'
import { dts } from 'bun-plugin-dtsx'

console.log('Building...')

// await $`rm -rf ./dist`

const result = await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  plugins: [
    dts(),
  ],
})

if (!result.success) {
  console.error('Build failed')

  for (const message of result.logs) {
    // Bun will pretty print the message object
    console.error(message)
  }

  process.exit(1)
}

console.log('Build complete')

await $`cp ./dist/src/index.js ./dist/index.js`
await $`rm -rf ./dist/src`
