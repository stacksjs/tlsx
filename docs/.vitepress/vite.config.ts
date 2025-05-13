import { resolve } from 'node:path'
// import Inspect from 'vite-plugin-inspect'
import UnoCSS from 'unocss/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { tlsx } from '../../packages/vite-plugin/src'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

// Detect if running in Bun
const IS_BUN = typeof process !== 'undefined' &&
  typeof process.versions !== 'undefined' &&
  typeof process.versions.bun !== 'undefined'

// Use Vite's default host for consistency
const HOST = '127.0.0.1'

// Get user's home directory for certificate paths - use the direct path
const HOME_DIR = os.homedir()
const CERT_DIR = path.join(HOME_DIR, '.tlsx', 'ssl')

// Define certificate paths
const CERT_PATH = path.join(CERT_DIR, 'localhost.crt')
const KEY_PATH = path.join(CERT_DIR, 'localhost.key')
const CA_CERT_PATH = path.join(CERT_DIR, 'localhost.ca.crt')

// Check if certificates exist
const certExists = fs.existsSync(CERT_PATH)
const keyExists = fs.existsSync(KEY_PATH)

// Create HTTPS config if certificates exist
const httpsConfig = certExists && keyExists ? {
  key: fs.readFileSync(KEY_PATH, 'utf-8'),
  cert: fs.readFileSync(CERT_PATH, 'utf-8'),
} : undefined

export default defineConfig({
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },

  resolve: {
    dedupe: [
      'vue',
      '@vue/runtime-core',
    ],
  },

  plugins: [
    // Add HTTPS support using tlsx
    tlsx({
      host: HOST, // Use numeric IP instead of hostname
      // Certificate configuration
      domain: 'localhost',
      hostCertCN: 'localhost',
      commonName: 'localhost',
      altNameURIs: ['localhost'],
      altNameIPs: [HOST],
      // Certificate paths - use direct paths, not nested
      basePath: CERT_DIR,
      certPath: CERT_PATH,
      keyPath: KEY_PATH,
      caCertPath: CA_CERT_PATH,
      // Enable verbose logging for debugging
      verbose: true,
      // Enable HTTPS
      https: true,
      // Automatically add certificate to trust store
      autoAddToTrustStore: false, // We've already added it manually
    }),

    // custom
    // MarkdownTransform(),
    // Contributors(contributions),

    // plugins
    Components({
      dirs: resolve(__dirname, 'theme/components'),
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      resolvers: [
        IconsResolver({
          componentPrefix: '',
        }),
      ],
      dts: resolve(__dirname, 'components.d.ts'),
      transformer: 'vue3',
    }),

    Icons({
      compiler: 'vue3',
      defaultStyle: 'display: inline-block',
    }),

    UnoCSS(resolve(__dirname, 'unocss.config.ts')),

    // Inspect(),
  ],

  optimizeDeps: {
    exclude: [
      // 'vue',
      'body-scroll-lock',
    ],
  },
})
