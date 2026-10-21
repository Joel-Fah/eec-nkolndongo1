/**
 * Module boundaries (Phase 02 §6.6): a module talks to another only through its public entry
 * (`@eec/module-<id>`), never reaches into its files, never imports the apps, and never escapes its own
 * folder with relative paths. Only the registry files here may use the `/api` and `/admin` entries.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = import.meta.dirname
// A module is a folder with its own package.json (skips node_modules, cli, .turbo…).
const moduleIds = readdirSync(root).filter(
  (d) =>
    statSync(join(root, d)).isDirectory() &&
    existsSync(join(root, d, 'package.json')) &&
    d !== 'node_modules',
)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : files(p)
    return /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

const IMPORT = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

describe('module boundaries', () => {
  it('finds modules to check', () => expect(moduleIds.length).toBeGreaterThan(0))

  for (const id of moduleIds) {
    it(`module "${id}" respects the boundaries`, () => {
      const problems: string[] = []
      for (const file of files(join(root, id, 'src'))) {
        const source = readFileSync(file, 'utf8')
        for (const m of source.matchAll(IMPORT)) {
          const spec = m[1] ?? m[2] ?? ''
          const where = `${relative(root, file)} → ${spec}`
          if (/^@eec\/(api|admin|web)(\/|$)/.test(spec)) problems.push(`imports an app: ${where}`)
          const other = /^@eec\/module-([a-z0-9-]+)(\/.*)?$/.exec(spec)
          if (other && other[1] !== id && other[2])
            problems.push(`reaches into another module: ${where}`)
          if (spec.startsWith('../') && !join(file, '..', spec).startsWith(join(root, id)))
            problems.push(`escapes its folder: ${where}`)
        }
      }
      expect(problems).toEqual([])
    })
  }
})
