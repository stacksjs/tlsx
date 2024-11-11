import { $ } from 'bun'
import { dts } from 'bun-plugin-dts-auto'

console.log('Building...')

// await $`rm -rf ./dist`

const result = await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // minify: true,
  // sourcemap: 'inline',
  // external: ['bun-plugin-dts-auto'],
  // plugins: [
  //   dts({
  //     root: './src',
  //     outdir: './dist',
  //   }),
  // ],
})

if (!result.success) {
  console.error('Build failed')

  for (const message of result.logs) {
    // Bun will pretty print the message object
    console.error(message)
  }

  process.exit(1)
}

// eslint-disable-next-line no-console
console.log('Build complete')

await $`cp ./dist/src/index.js ./dist/index.js`
await $`rm -rf ./dist/src`
await $`cp ./dist/bin/cli.js ./dist/cli.js`
await $`rm -rf ./dist/bin`
await $`cp ./bin/cli.d.ts ./dist/cli.d.ts` // while bun-plugin-dts-auto doesn't support bin files well
await $`rm ./bin/cli.d.ts`
