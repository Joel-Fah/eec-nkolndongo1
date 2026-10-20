/**
 * Builds the messages Paraglide compiles: the shared messages (messages/{fr,en}.json) plus each module's
 * (modules/<id>/i18n/{fr,en}.json), nested under the module id so keys stay namespaced (`settings.…`).
 * Output: messages/merged/{fr,en}.json (generated, gitignored). Run before every compile.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const modulesDir = join(root, '../../modules')
const out = join(root, 'messages/merged')
mkdirSync(out, { recursive: true })

export function moduleMessageDirs(): { id: string; dir: string }[] {
  if (!existsSync(modulesDir)) return []
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(modulesDir, d.name, 'i18n')))
    .map((d) => ({ id: d.name, dir: join(modulesDir, d.name, 'i18n') }))
}

for (const locale of ['fr', 'en']) {
  const base = JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'))
  for (const { id, dir } of moduleMessageDirs()) {
    if (id in base) throw new Error(`Module "${id}" collides with a shared message namespace`)
    const { $schema: _, ...messages } = JSON.parse(
      readFileSync(join(dir, `${locale}.json`), 'utf8'),
    )
    base[id] = messages
  }
  writeFileSync(join(out, `${locale}.json`), `${JSON.stringify(base, null, 2)}\n`)
}
