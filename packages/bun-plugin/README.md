# bun-plugin-tlsx

A Bun plugin that provides custom domain names with HTTPS for local development, replacing `localhost:port` with a real domain.

## Installation

```bash
bun add bun-plugin-tlsx
```

```bash
npm install bun-plugin-tlsx
```

## Usage

```typescript
import { plugin } from 'bun-plugin-tlsx'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  plugins: [
    plugin({
      domain: 'my-app.test',
      https: true,
    }),
  ],
})
```

### Options

```typescript
plugin({
  // The domain to use instead of localhost:port
  // Defaults to '$projectName.localhost'
  domain: 'my-app.test',

  // Enable HTTPS (default: true)
  https: true,

  // Enable debug logging (default: false)
  verbose: false,
})
```

## Features

- Custom domain names for local development (e.g., `https://my-app.test`)
- Automatic HTTPS support via rpx
- Auto-detection of project name from `package.json`
- Automatic cleanup on process exit
- Debug logging mode

## License

MIT
