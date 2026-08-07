import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Exercise the CLI as npm ships it, not as the repo runs it.
 *
 * 0.13.16 published a CLI that died on startup for every user:
 *
 *   SyntaxError: JSON Parse error: Unexpected identifier "import"
 *       at .../dist/bin/cli.js
 *
 * The cause was `await import('../package.json', { with: { type: 'json' } })`
 * to read the version. Bundling rewrote it into a runtime resolution that
 * reached a JavaScript module and handed it to JSON.parse. Running from the
 * repo worked. The compiled standalone binary worked. `bun test` passed. Only
 * the published bundle was broken, and nothing ran the published bundle — it
 * was found by installing tlsx through a package manager on a server.
 *
 * These tests build bin/cli.ts the way the package is built and run it from the
 * layout the package has, where the manifest sits two directories above the
 * entry point instead of one.
 */

const ROOT = path.resolve(import.meta.dir, '..')
let staged: string

beforeAll(async () => {
  staged = fs.mkdtempSync(path.join(os.tmpdir(), 'tlsx-published-'))
  fs.mkdirSync(path.join(staged, 'dist', 'bin'), { recursive: true })

  // These options must mirror packages/tlsx/build.ts exactly. They are what
  // makes the difference: `target: 'node'` with splitting is what rewrote the
  // JSON import into the resolution that broke. Building with other options
  // produces a bundle that works and proves nothing.
  const build = await Bun.build({
    entrypoints: [path.join(ROOT, 'bin', 'cli.ts')],
    outdir: path.join(staged, 'dist', 'bin'),
    format: 'esm',
    target: 'node',
    minify: true,
    splitting: true,
  })

  if (!build.success)
    throw new Error(`bundling the CLI failed: ${build.logs.map(String).join('\n')}`)

  // The manifest lands at the package root, two levels above the entry point —
  // the layout that broke, and the one the repo never reproduces.
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(staged, 'package.json'))
})

afterAll(() => {
  fs.rmSync(staged, { recursive: true, force: true })
})

function runCli(...args: string[]): { code: number, out: string } {
  const run = Bun.spawnSync(['bun', path.join(staged, 'dist', 'bin', 'cli.js'), ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    code: run.exitCode ?? 0,
    out: `${run.stdout?.toString() ?? ''}${run.stderr?.toString() ?? ''}`,
  }
}

describe('the CLI as published', () => {
  it('starts at all', () => {
    const { code, out } = runCli('--version')

    expect(out).not.toContain('SyntaxError')
    expect(out).not.toContain('JSON Parse error')
    expect(code).toBe(0)
  })

  it('reports the version from the manifest', () => {
    const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
    const { out } = runCli('--version')

    expect(out).toContain(expected)
  })

  it('never reports the unknown-version fallback from a correct layout', () => {
    // The fallback exists so a bad layout degrades to a wrong string rather
    // than an unusable binary. Reaching it here would mean the lookup broke.
    expect(runCli('--version').out).not.toContain('unknown')
  })

  it('runs a command', () => {
    // --version can pass while the command table is broken; this asserts the
    // program actually got as far as building it.
    const { code, out } = runCli('--help')

    expect(code).toBe(0)
    expect(out).toContain('Usage:')
    expect(out).toContain('acme:issue')
  })
})
