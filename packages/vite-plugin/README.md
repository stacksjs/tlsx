# vite-plugin-tlsx

A Vite plugin that adds seamless HTTPS support to your Vite dev server using the powerful [tlsx](https://github.com/stacksjs/tlsx) library.

## Features

- 🔒 Automatic HTTPS setup for local development
- 🤖 Auto-generation of trusted TLS certificates
- 🌐 Custom domain support
- 🔑 System-level trust store integration
- 🚀 Perfect for VitePress and other Vite-based projects

## Installation

```bash
# npm
npm install vite-plugin-tlsx -D

# yarn
yarn add vite-plugin-tlsx -D

# pnpm
pnpm add vite-plugin-tlsx -D

# bun
bun add vite-plugin-tlsx -D
```

## Usage

### Basic Usage

Add the plugin to your `vite.config.ts` file:

```ts
import { defineConfig } from 'vite'
import { tlsx } from 'vite-plugin-tlsx'

export default defineConfig({
  plugins: [
    tlsx({
      // options here
    }),
  ],
})
```

### With VitePress

```ts
// docs/.vitepress/vite.config.ts
import { defineConfig } from 'vite'
import { tlsx } from 'vite-plugin-tlsx'

export default defineConfig({
  plugins: [
    tlsx({
      domain: 'docs.myproject.local',
      verbose: true,
    }),
    // other plugins...
  ],
})
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `https` | `boolean` | `true` | Enable/disable HTTPS |
| `domain` | `string` | `'stacks.localhost'` | Domain for the certificate |
| `altNameIPs` | `string[]` | `['127.0.0.1']` | Alternative IPs for the certificate |
| `altNameURIs` | `string[]` | `['localhost']` | Alternative URIs for the certificate |
| `organizationName` | `string` | `'Local Development'` | Organization name for the certificate |
| `countryName` | `string` | `'US'` | Country name for the certificate |
| `stateName` | `string` | `'California'` | State name for the certificate |
| `localityName` | `string` | `'Playa Vista'` | Locality name for the certificate |
| `commonName` | `string` | `'stacks.localhost'` | Common name for the certificate |
| `validityDays` | `number` | `825` | Number of days the certificate is valid for |
| `basePath` | `string` | `''` | Base path for certificate storage |
| `caCertPath` | `string` | `'~/.stacks/ssl/stacks.localhost.ca.crt'` | Path to CA certificate |
| `certPath` | `string` | `'~/.stacks/ssl/stacks.localhost.crt'` | Path to certificate |
| `keyPath` | `string` | `'~/.stacks/ssl/stacks.localhost.crt.key'` | Path to certificate key |
| `verbose` | `boolean` | `false` | Enable verbose logging |

## How It Works

1. The plugin checks if certificates already exist at the specified paths
2. If not, it generates a new CA certificate (if needed) and server certificate
3. It adds the CA certificate to your system's trust store (might require sudo/admin permissions)
4. It configures Vite's dev server to use the generated certificates for HTTPS
5. Your browser will now trust the connection without warnings

## License

MIT

## Credits

- [tlsx](https://github.com/stacksjs/tlsx) - The TLS/SSL library used for certificate generation
- [Stacks.js](https://github.com/stacksjs) - The ecosystem this plugin is part of
