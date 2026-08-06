/**
 * Compile the standalone `tlsx` binaries the GitHub release advertises.
 *
 * `release.yml` has listed five zips since the workflow was written, but
 * nothing ever produced them — `action-releaser` silently skips files that do
 * not exist, so every release published an empty downloads section and no job
 * ever failed. Anyone told to "grab the binary" found a release page with none.
 */
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const TARGETS = [
  { bun: 'bun-linux-x64', name: 'tlsx-linux-x64' },
  { bun: 'bun-linux-arm64', name: 'tlsx-linux-arm64' },
  { bun: 'bun-windows-x64', name: 'tlsx-windows-x64', ext: '.exe' },
  { bun: 'bun-darwin-x64', name: 'tlsx-darwin-x64' },
  { bun: 'bun-darwin-arm64', name: 'tlsx-darwin-arm64' },
] as const

const outDir = path.resolve('packages/tlsx/bin')
mkdirSync(outDir, { recursive: true })

let failed = 0
for (const target of TARGETS) {
  const binary = path.join(outDir, `${target.name}${'ext' in target ? target.ext : ''}`)
  const zip = path.join(outDir, `${target.name}.zip`)

  const compile = Bun.spawnSync([
    'bun',
    'build',
    'packages/tlsx/bin/cli.ts',
    '--compile',
    `--target=${target.bun}`,
    '--outfile',
    binary,
  ], { stdout: 'inherit', stderr: 'inherit' })

  if (compile.exitCode !== 0) {
    console.error(`✗ ${target.name}: compile failed`)
    failed++
    continue
  }

  // Zip from inside the directory so the archive holds a bare executable
  // rather than packages/tlsx/bin/… path components.
  rmSync(zip, { force: true })
  const archive = Bun.spawnSync(['zip', '-j', '-q', zip, binary], { stdout: 'inherit', stderr: 'inherit' })
  if (archive.exitCode !== 0) {
    console.error(`✗ ${target.name}: zip failed`)
    failed++
    continue
  }

  console.log(`✓ ${path.basename(zip)}`)
}

if (failed > 0) {
  console.error(`${failed} target(s) failed`)
  process.exit(1)
}
