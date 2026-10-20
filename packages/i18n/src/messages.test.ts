import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createT } from './t.ts'
import { NNBSP } from './typography.ts'

type Tree = { [key: string]: string | Tree }

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    if (key === '$schema') return []
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : keys(value, path)
  })
}

const load = (locale: string): Tree =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))

const modulesDir = new URL('../../../modules/', import.meta.url)
const moduleIds = existsSync(modulesDir)
  ? readdirSync(modulesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/i18n/fr.json`, modulesDir)))
      .map((d) => d.name)
  : []
const loadModule = (id: string, locale: string): Tree =>
  JSON.parse(readFileSync(new URL(`${id}/i18n/${locale}.json`, modulesDir), 'utf8'))

describe('messages', () => {
  it('FR and EN define exactly the same keys', () => {
    expect(keys(load('en')).sort()).toEqual(keys(load('fr')).sort())
  })

  it.each(moduleIds)('module "%s": FR and EN define exactly the same keys', (id) => {
    expect(keys(loadModule(id, 'en')).sort()).toEqual(keys(loadModule(id, 'fr')).sort())
  })

  it('translates per call and applies French typography', () => {
    expect(createT('en')('common.greeting', { name: 'Joël' })).toBe('Hello Joël')
    expect(createT('fr')('common.greeting', { name: 'Joël' })).toBe('Bonjour Joël')
    // French typography: a no-break space before the colon.
    expect(createT('fr')('site.tagline')).toContain('êtes\u00A0:')
    expect(NNBSP).toBe(' ')
  })
})
