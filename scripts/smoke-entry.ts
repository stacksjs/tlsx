import { resolve } from 'node:path'

/**
 * Post-build smoke check: import a freshly built entry IN THIS PROCESS and
 * assert the expected named exports are actually defined.
 *
 * This guards the class of bug that shipped in v0.13.10–v0.13.12: a bundler
 * facade desync where the emitted entry re-exports locals its import list
 * never declared — the artifact builds "successfully" but fails to link in
 * both Bun and Node. A build that produces an unimportable entry must fail
 * here, before any publish can pick it up.
 *
 * @param entryPath - Built entry file, resolved against process.cwd().
 * @param expectedExports - Named exports that must be defined on the module.
 */
export async function smokeEntry(entryPath: string, expectedExports: string[]): Promise<void> {
  const abs = resolve(process.cwd(), entryPath)
  const mod = await import(abs) as Record<string, unknown>
  const missing = expectedExports.filter(name => mod[name] === undefined)
  if (missing.length > 0)
    throw new Error(`Smoke check failed for ${entryPath}: missing exports: ${missing.join(', ')}`)

  console.log(`Smoke check passed: ${entryPath} (${Object.keys(mod).length} exports, ${expectedExports.length} expected names present)`)
}
