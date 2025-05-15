# vite-plugin-tlsx

A Vite plugin that enables HTTPS for the Vite development server using TLSX. This plugin automatically generates and manages SSL certificates for your local development environment, making it easy to test HTTPS functionality. _Or simply enjoy pretty URLs in your browser._

## Features

- 🔐 Automatic SSL certificate generation
- 🔄 Certificate validation and regeneration when needed
- 🛡️ System trust store integration
- 🚀 Compatible with VitePress and other Vite-based frameworks
- 🧩 Simple configuration
- 🔒 Modern TLS configuration with secure cipher suites
- 🌐 Browser compatibility mode for hassle-free local development

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

Add the plugin to your `vite.config.ts` file:

```ts
import tlsx from 'vite-plugin-tlsx'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tlsx({
      // Options (all optional)
      domain: 'localhost', // Default domain name
      trustCertificate: true, // Automatically trust the certificate (default: true)
      forceRegeneration: false, // Force certificate regeneration (default: false)
      minTlsVersion: 'TLSv1.2', // Minimum TLS version (default: 'TLSv1.2')
      debug: false, // Enable debug logging (default: false)
      browserCompatible: true, // Generate certificates that work in browsers (default: true)
    }),
  ],
})
```

### With VitePress

```ts
// .vitepress/config.ts
import tlsx from 'vite-plugin-tlsx'
import { defineConfig } from 'vitepress'

export default defineConfig({
  vite: {
    plugins: [
      tlsx({
        domain: 'my-docs.local',
      }),
    ],
  },
})
```

## Configuration Options

The plugin accepts all configuration options from TLSX, plus the following plugin-specific options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trustCertificate` | `boolean` | `true` | Whether to automatically add the certificate to system trust stores |
| `forceRegeneration` | `boolean` | `false` | Force regeneration of certificates even if they exist |
| `domain` | `string` | `'localhost'` | Domain name for the certificate |
| `altNameURIs` | `string[]` | `['localhost']` | Alternative URI names for the certificate |
| `altNameIPs` | `string[]` | `['127.0.0.1']` | Alternative IP addresses for the certificate |
| `verbose` | `boolean` | `false` | Enable verbose logging |
| `debug` | `boolean` | `false` | Enable debug mode (includes verbose logging) |
| `minTlsVersion` | `'TLSv1.2'` \| `'TLSv1.3'` | `'TLSv1.2'` | Minimum TLS version to support |
| `ciphers` | `string` | Browser-compatible defaults | Custom cipher suites string (advanced) |
| `browserCompatible` | `boolean` | `true` | Generate certificates optimized for browser compatibility |

## Troubleshooting

If you encounter an `ERR_SSL_PROTOCOL_ERROR` in your browser:

### Chrome/Chromium

1. Open Chrome and navigate to `chrome://flags/#allow-insecure-localhost`
2. Enable "Allow invalid certificates for resources loaded from localhost"
3. Restart Chrome and try again

### Firefox

1. Type `about:config` in your address bar
2. Search for `network.security.ports.banned.override`
3. If it doesn't exist, create it as a string preference
4. Add the port number your dev server uses (e.g., `5173`) to the list

### All Browsers

1. Try using `http://localhost:5173` instead of `https://localhost:5173`
2. Set `forceRegeneration: true` in your plugin options to create fresh certificates
3. Restart your browser after generating new certificates

## License

MIT

## Credits

- [tlsx](https://github.com/stacksjs/tlsx) - The TLS/SSL library used for certificate generation
- [Stacks.js](https://github.com/stacksjs) - The ecosystem this plugin is part of
