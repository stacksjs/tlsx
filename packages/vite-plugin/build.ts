import { build } from 'bun'
import { dts } from 'bun-plugin-dtsx'

// Build the package
await build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  external: ['vite', '@stacksjs/tlsx'],
  target: 'node',
  sourcemap: 'external',
  plugins: [dts()],
})

console.log('✅ Build completed')
