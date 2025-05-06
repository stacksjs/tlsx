import type { BunPlugin, ServeOptions } from 'bun'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

interface RpxPluginOptions {
  /**
   * The domain to use instead of localhost:port
   * @example 'my-app.test', 'awesome.localhost'
   * @default '$projectName.localhost'
   */
  domain?: string

  /**
   * Allow HTTPS
   * @default true
   */
  https?: boolean

  /**
   * Enable debug logging
   * @default false
   */
  verbose?: boolean
}

interface ServeFunction {
  (options?: ServeOptions): {
    start: (...args: unknown[]) => Promise<{ port: number }>
    stop: () => Promise<void>
  }
}

interface PluginBuilder {
  serve: ServeFunction
}

const defaultOptions: Required<RpxPluginOptions> = {
  domain: '',
  https: true,
  verbose: false,
}

/**
 * A Bun plugin to provide custom domain names for local development
 * instead of using localhost:port
 */
export function plugin(options: RpxPluginOptions = {}): BunPlugin {
  const pluginOpts: Required<RpxPluginOptions> = { ...defaultOptions, ...options }

  // Store server instance and port to clean up later
  let serverPort: number | null = null
  let rpxProcess: ReturnType<typeof spawn> | null = null

  return {
    name: 'bun-plugin-rpx',
    async setup(build) {
      // Get the project name from package.json as a fallback domain
      let projectName = ''
      try {
        const pkgPath = path.join(process.cwd(), 'package.json')
        const pkg = await import(pkgPath, {
          with: { type: 'json' },
        })
        projectName = pkg.default.name || 'app'
      }
      catch {
        projectName = 'app'
      }

      // Use provided domain or fallback to projectName.localhost
      const domain = pluginOpts.domain || `${projectName}.localhost`

      // Hook into serve to intercept port and start rpx
      const buildWithServe = build as unknown as PluginBuilder
      const originalServe = buildWithServe.serve

      buildWithServe.serve = (options?: ServeOptions) => {
        // Store the original serve function result
        const server = originalServe(options)
        const originalStart = server.start

        server.start = async (...args: unknown[]) => {
          // Start the original server
          const result = await originalStart.apply(server, args)

          // Get the port from the server
          serverPort = result.port

          if (serverPort) {
            await startRpx(domain, serverPort, pluginOpts.https, pluginOpts.verbose)
          }

          return result
        }

        // Handle server stop to clean up rpx
        const originalStop = server.stop
        server.stop = async () => {
          if (rpxProcess) {
            rpxProcess.kill()
            rpxProcess = null
          }

          return originalStop.apply(server)
        }

        return server
      }

      // Handle build process exit
      process.on('exit', cleanup)
      process.on('SIGINT', () => {
        cleanup()
        process.exit(0)
      })
      process.on('SIGTERM', () => {
        cleanup()
        process.exit(0)
      })
    },
  }

  /**
   * Start rpx process
   */
  async function startRpx(domain: string, port: number, https: boolean, verbose: boolean) {
    // Find rpx binary - it should be installed as a dependency
    try {
      const rpxBinary = 'rpx'

      // Build the command to run rpx
      const args = [
        `--from=localhost:${port}`,
        `--to=${domain}`,
      ]

      // Add HTTPS flag if needed
      if (https) {
        args.push('--https')
      }

      // Add verbose flag if needed
      if (verbose) {
        args.push('--verbose')
      }

      // Start rpx process
      rpxProcess = spawn(rpxBinary, args, {
        stdio: verbose ? 'inherit' : 'ignore',
        detached: false,
      })

      // Log startup information
      console.error(`\n🌐 rpx: ${https ? 'https' : 'http'}://${domain} -> localhost:${port}\n`)

      // Handle process events
      rpxProcess.on('error', (err) => {
        console.error(`rpx error: ${err.message}`)
        rpxProcess = null
      })

      rpxProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`rpx exited with code ${code}`)
        }
        rpxProcess = null
      })
    }
    catch (error) {
      console.error('Failed to start rpx:', error)
    }
  }

  /**
   * Clean up rpx process
   */
  function cleanup() {
    if (rpxProcess) {
      rpxProcess.kill()
      rpxProcess = null
    }
  }
}

export default plugin
