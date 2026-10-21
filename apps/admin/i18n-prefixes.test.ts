import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADMIN_NAMESPACES } from './i18n-prefixes.ts'

const root = join(import.meta.dirname, '../..')
const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((f) => {
        if (f === 'node_modules' || f === 'dist' || f === 'paraglide') return []
        const p = join(dir, f)
        return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) ? [p] : []
      })

describe('admin message namespaces', () => {
  it('every key the admin code uses belongs to a bundled namespace', () => {
    const modules = readdirSync(join(root, 'modules'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'node_modules')
      .map((d) => d.name)
    const allowed = new Set<string>([...ADMIN_NAMESPACES, ...modules])
    const files = [
      ...walk(join(root, 'apps/admin/src')),
      ...walk(join(root, 'packages/admin-kit/src')),
      ...modules.flatMap((m) => walk(join(root, 'modules', m, 'src'))),
    ]
    const bad: string[] = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      // t('namespace.key') and t(`namespace.${x}`) written literally; module helpers build `<id>.<key>` themselves.
      for (const m of text.matchAll(/\bt\(\s*[`'"]([a-z]+)\.[^`'"]*[`'"]/g)) {
        const ns = m[1] as string
        if (!allowed.has(ns)) bad.push(`${f.replace(root, '')}: ${ns}`)
      }
    }
    expect(bad).toEqual([])
  })
})
