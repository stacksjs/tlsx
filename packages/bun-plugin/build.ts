import { dts } from 'bun-plugin-dtsx'

console.log('Building bun-plugin...')

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  minify: true,
  splitting: true,
  plugins: [dts()],
})

console.log('Built bun-plugin')
