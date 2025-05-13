/* eslint-disable no-console */
import type { Plugin, ViteDevServer } from 'vite'
import type { TlsConfig } from '../../tlsx/src/types'
import fs from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { createRootCA, defaultConfig, generateCertificate, storeCACertificate, storeCertificate, config as tlsxConfig, addCertToSystemTrustStoreAndSaveCert } from '../../tlsx/src/index'

// Promisify exec for async/await usage
const execAsync = promisify(exec)

// Detect if running in Bun
const IS_BUN = typeof process !== 'undefined' &&
  typeof process.versions !== 'undefined' &&
  typeof process.versions.bun !== 'undefined'

/**
 * Options for the TLSX Vite plugin
 */
export interface TlsxPluginOptions {
  /**
   * Enable HTTPS for the development server
   * @default true
   */
  https?: boolean

  /**
   * Port to use for HTTPS server
   * If not specified, Vite's default port will be used
   */
  port?: number

  /**
   * Host to bind the server to
   * @default 'localhost'
   */
  host?: string

  /**
   * Automatically add the certificate to the system trust store
   * This may require sudo/admin privileges
   * @default false
   */
  autoAddToTrustStore?: boolean

  /**
   * Prompt for sudo password if needed for adding to trust store
   * @default true
   */
  promptForSudo?: boolean

  // Allow any other TLSX options
  [key: string]: any
}

/**
 * Creates a Vite plugin that adds HTTPS support using TLSX
 *
 * @param options - Configuration options for TLSX
 * @returns A Vite plugin
 */
export function tlsx(options: TlsxPluginOptions = {}): Plugin {
  const pluginOptions = { ...options }
  const https = pluginOptions.https !== false
  const autoAddToTrustStore = pluginOptions.autoAddToTrustStore === true
  const promptForSudo = pluginOptions.promptForSudo !== false
  let serverStarted = false
  let certAdded = false
  let httpsEnabled = false

  // Special handling for Bun
  if (IS_BUN) {
    console.log('[vite-plugin-tlsx] Detected Bun runtime');

    // Force numeric IP for Bun to avoid ENOENT issues
    if (pluginOptions.host === 'localhost') {
      pluginOptions.host = '127.0.0.1';
      console.log('[vite-plugin-tlsx] Changed host from "localhost" to "127.0.0.1" for Bun compatibility');
    }
  }

  /**
   * Add certificate to system trust store
   */
  async function addCertToTrustStore(certPath: string, caCertPath: string): Promise<boolean> {
    try {
      console.log('[vite-plugin-tlsx] Adding certificate to system trust store...');

      const platform = os.platform();

      if (platform === 'darwin') {
        // macOS
        console.log('[vite-plugin-tlsx] Detected macOS, adding certificate to Keychain...');

        if (promptForSudo) {
          console.log('[vite-plugin-tlsx] This operation requires sudo privileges.');
          console.log('[vite-plugin-tlsx] Please enter your password when prompted.');
        }

        await execAsync(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCertPath}"`);
        console.log('[vite-plugin-tlsx] Certificate added to macOS Keychain successfully!');
        return true;
      }
      else if (platform === 'win32') {
        // Windows
        console.log('[vite-plugin-tlsx] Detected Windows, adding certificate to Windows Certificate Store...');
        await execAsync(`certutil -addstore -enterprise -f -v Root "${caCertPath}"`);
        console.log('[vite-plugin-tlsx] Certificate added to Windows Certificate Store successfully!');
        return true;
      }
      else if (platform === 'linux') {
        // Linux - different distros have different methods
        console.log('[vite-plugin-tlsx] Detected Linux, adding certificate to trust store...');

        // Try to detect the distribution
        try {
          const { stdout: osRelease } = await execAsync('cat /etc/os-release');

          if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
            // Ubuntu/Debian
            if (promptForSudo) {
              console.log('[vite-plugin-tlsx] This operation requires sudo privileges.');
              console.log('[vite-plugin-tlsx] Please enter your password when prompted.');
            }

            await execAsync(`sudo cp "${caCertPath}" /usr/local/share/ca-certificates/tlsx-ca.crt`);
            await execAsync('sudo update-ca-certificates');
            console.log('[vite-plugin-tlsx] Certificate added to Ubuntu/Debian trust store successfully!');
            return true;
          }
          else if (osRelease.includes('CentOS') || osRelease.includes('Fedora') || osRelease.includes('RHEL')) {
            // CentOS/Fedora/RHEL
            if (promptForSudo) {
              console.log('[vite-plugin-tlsx] This operation requires sudo privileges.');
              console.log('[vite-plugin-tlsx] Please enter your password when prompted.');
            }

            await execAsync(`sudo cp "${caCertPath}" /etc/pki/ca-trust/source/anchors/tlsx-ca.crt`);
            await execAsync('sudo update-ca-trust extract');
            console.log('[vite-plugin-tlsx] Certificate added to CentOS/Fedora/RHEL trust store successfully!');
            return true;
          }
          else {
            // Generic approach for other Linux distributions
            console.log('[vite-plugin-tlsx] Could not determine specific Linux distribution.');
            console.log('[vite-plugin-tlsx] Please manually add the certificate to your trust store:');
            console.log(`[vite-plugin-tlsx] Certificate path: ${caCertPath}`);
            return false;
          }
        } catch (error) {
          console.error('[vite-plugin-tlsx] Error detecting Linux distribution:', error);
          console.log('[vite-plugin-tlsx] Please manually add the certificate to your trust store:');
          console.log(`[vite-plugin-tlsx] Certificate path: ${caCertPath}`);
          return false;
        }
      }
      else {
        // Unsupported platform
        console.log(`[vite-plugin-tlsx] Unsupported platform: ${platform}`);
        console.log('[vite-plugin-tlsx] Please manually add the certificate to your trust store:');
        console.log(`[vite-plugin-tlsx] Certificate path: ${caCertPath}`);
        return false;
      }
    } catch (error) {
      console.error('[vite-plugin-tlsx] Error adding certificate to trust store:', error);
      console.log('[vite-plugin-tlsx] Please manually add the certificate to your trust store:');
      console.log(`[vite-plugin-tlsx] Certificate path: ${caCertPath}`);
      return false;
    }
  }

  /**
   * Create a self-signed certificate
   */
  async function createCertificate(mergedConfig: TlsConfig): Promise<{ certPath: string, caCertPath: string } | null> {
    try {
      // First create a root CA if needed
      let rootCA = mergedConfig.rootCA
      if (!rootCA || !rootCA.certificate || !rootCA.privateKey) {
        console.log('[vite-plugin-tlsx] Creating root CA certificate...')
        rootCA = await createRootCA(mergedConfig)
      }

      // Then generate the certificate
      const cert = await generateCertificate({
        domain: mergedConfig.domain,
        hostCertCN: mergedConfig.hostCertCN,
        altNameIPs: mergedConfig.altNameIPs,
        altNameURIs: mergedConfig.altNameURIs,
        validityDays: mergedConfig.validityDays,
        organizationName: mergedConfig.organizationName,
        countryName: mergedConfig.countryName,
        stateName: mergedConfig.stateName,
        localityName: mergedConfig.localityName,
        commonName: mergedConfig.commonName,
        verbose: mergedConfig.verbose,
        rootCA,
      })

      // Store the certificates
      const certPath = storeCertificate({
        certificate: cert.certificate,
        privateKey: cert.privateKey,
      }, mergedConfig)

      // Store the root CA certificate
      const caCertPath = storeCACertificate(rootCA.certificate, mergedConfig)

      return { certPath, caCertPath }
    } catch (error) {
      console.error('[vite-plugin-tlsx] Error creating certificate:', error)
      return null
    }
  }

  return {
    name: 'vite-plugin-tlsx',

    apply: 'serve', // Only apply during development

    config: async (config) => {
      if (!https) {
        return config
      }

      try {
        // Merge config with defaults using type assertion to avoid complex type issues
        const mergedConfig = {
          ...defaultConfig,
          ...tlsxConfig,
          ...pluginOptions,
        } as TlsConfig

        // Create directories if they don't exist
        const certDir = path.dirname(mergedConfig.certPath)
        if (!fs.existsSync(certDir)) {
          fs.mkdirSync(certDir, { recursive: true })
        }

        // Check if certificate files exist
        const certExists = fs.existsSync(mergedConfig.certPath)
        const keyExists = fs.existsSync(mergedConfig.keyPath)
        const caCertExists = fs.existsSync(mergedConfig.caCertPath)

        let certPath = mergedConfig.certPath
        let caCertPath = mergedConfig.caCertPath

        console.log('[vite-plugin-tlsx] Certificate paths:', {
          certPath,
          keyPath: mergedConfig.keyPath,
          caCertPath
        })

        // Generate new certificates if they don't exist
        if (!certExists || !keyExists || !caCertExists) {
          console.log('[vite-plugin-tlsx] Generating TLS certificates...')

          const result = await createCertificate(mergedConfig)
          if (!result) {
            console.log('[vite-plugin-tlsx] Failed to generate certificates, falling back to HTTP')
            return config
          }

          certPath = result.certPath
          caCertPath = result.caCertPath

          console.log(`[vite-plugin-tlsx] TLS certificates generated at ${certPath}`)
        } else {
          console.log(`[vite-plugin-tlsx] Using existing TLS certificates at ${certPath}`)
        }

        // Add certificate to trust store if requested
        if (autoAddToTrustStore && !certAdded) {
          certAdded = await addCertToTrustStore(certPath, caCertPath)
        }

        // Make sure the certificate files exist before configuring HTTPS
        if (!fs.existsSync(certPath) || !fs.existsSync(mergedConfig.keyPath)) {
          console.error('[vite-plugin-tlsx] Certificate files not found, falling back to HTTP')
          return config
        }

        // Read certificate files
        const key = fs.readFileSync(mergedConfig.keyPath, 'utf-8')
        const cert = fs.readFileSync(certPath, 'utf-8')

        // Configure Vite server to use HTTPS
        const serverConfig: Record<string, any> = {
          // Use HTTPS with our certificates
          https: {
            key,
            cert,
          },
        }

        // Only set host and port if explicitly provided in plugin options
        if (pluginOptions.host) {
          serverConfig.host = pluginOptions.host
        }

        if (pluginOptions.port) {
          serverConfig.port = pluginOptions.port
        }

        // Configure HMR properly for HTTPS
        serverConfig.hmr = {
          protocol: 'wss', // Use secure WebSocket protocol for HTTPS
          // Don't set host or port - let Vite use its defaults or what's configured in vite.config.js
        }

        // Add server.port to serverConfig.hmr if it's available to prevent the 'undefined' port issue
        if (pluginOptions.port) {
          // If plugin has port specified, use it for HMR too
          serverConfig.hmr.port = pluginOptions.port
        } else if (config.server && typeof config.server.port === 'number') {
          // If there's a port in the main Vite config, use that
          serverConfig.hmr.port = config.server.port
        } else {
          // Fallback to Vite's default port
          serverConfig.hmr.port = 5173
        }

        // Disable HMR overlay that can cause refreshes
        serverConfig.hmr.overlay = false

        // Reduce file system polling to prevent excessive refreshes
        serverConfig.watch = {
          usePolling: false,
          interval: 5000, // Increase interval to 5 seconds
          binaryInterval: 10000, // Increase binary interval to 10 seconds
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/*.log',
            '**/dist/**',
            '**/.DS_Store',
            '**/.vitepress/cache/**',
          ],
        };

        // Disable HMR for some file types
        serverConfig.server = serverConfig.server || {};
        serverConfig.server.watch = {
          // These options will be used if the server.watch option is not explicitly overridden
          usePolling: false,
          interval: 5000,
          binaryInterval: 10000,
        };

        // Configure unstable options to reduce refreshes
        const unstableOptions = {
          hmrPartialAccept: true, // Enable partial HMR acceptance
        };
        serverConfig.experimental = {
          ...unstableOptions,
          ...serverConfig.experimental
        };

        // Don't use clientPort to avoid proxying
        serverConfig.hmr.clientPort = null

        console.log('[vite-plugin-tlsx] HMR configuration:', {
          protocol: serverConfig.hmr.protocol,
          port: serverConfig.hmr.port,
        });

        httpsEnabled = true
        console.log('[vite-plugin-tlsx] HTTPS configuration applied successfully')

        return {
          server: serverConfig,
        }
      }
      catch (error) {
        console.error('[vite-plugin-tlsx] Error setting up HTTPS:', error)
        console.log('[vite-plugin-tlsx] Falling back to HTTP...')
        return config
      }
    },

    configureServer(server: ViteDevServer) {
      // Add middleware to redirect HTTP to HTTPS if needed
      if (https && httpsEnabled) {
        server.middlewares.use((req, res, next) => {
          if (req.headers['x-forwarded-proto'] === 'http') {
            const host = req.headers.host || ''
            const url = `https://${host}${req.url}`
            res.writeHead(301, { Location: url })
            res.end()
          } else {
            next()
          }
        })
      }

      // Handle server startup
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address()
        if (address && typeof address !== 'string') {
          const protocol = https && httpsEnabled ? 'https' : 'http'
          const host = address.address === '::' ? 'localhost' : address.address
          const url = `${protocol}://${host}:${address.port}`

          console.log(`[vite-plugin-tlsx] Server running at: ${url}`)
          console.log(`[vite-plugin-tlsx] You can access the site at: ${url}`)

          // Add instructions for trusting the certificate if not auto-added
          if (https && httpsEnabled && !certAdded) {
            console.log(`[vite-plugin-tlsx] To trust the certificate, you may need to add it to your system trust store.`)
            console.log(`[vite-plugin-tlsx] Certificate path: ${(pluginOptions as any).certPath || defaultConfig.certPath}`)
            console.log(`[vite-plugin-tlsx] CA Certificate path: ${(pluginOptions as any).caCertPath || defaultConfig.caCertPath}`)
            console.log(`[vite-plugin-tlsx] To automatically add the certificate to your trust store, set autoAddToTrustStore: true in your vite.config.ts`)
          }

          serverStarted = true
        }
      })

      // Handle server errors
      server.httpServer?.once('error', (error) => {
        console.error('[vite-plugin-tlsx] Server error:', error)
        console.log('[vite-plugin-tlsx] Falling back to HTTP...')
        httpsEnabled = false
      })
    },
  }
}
