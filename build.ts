import { dts } from 'bun-plugin-dtsx'

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
