import path from 'node:path'
import { log } from '@stacksjs/logging'
import { $ } from 'bun'
import dts from 'bun-plugin-dts-auto'

log.info('Building...')

$.cwd(path.resolve(import.meta.dir, '..'))
await $`rm -rf ./dist`

await Bun.build({
  entrypoints: ['./src/index.ts', './bin/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  external: ['rollup', 'fsevents'],

  plugins: [
    dts({
      cwd: path.resolve(import.meta.dir, '..'),
    }),
  ],
})

await $`cp ./dist/src/index.js ./dist/index.js`
await $`rm -rf ./dist/src`
await $`cp ./dist/bin/cli.js ./dist/cli.js`
await $`rm -rf ./dist/bin`
await $`cp ./bin/cli.d.ts ./dist/cli.d.ts` // while bun-plugin-dts-auto doesn't support bin files well
await $`rm ./bin/cli.d.ts`

log.success('Built')
