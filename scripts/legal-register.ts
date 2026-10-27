/**
 * `pnpm --filter @eec/scripts legal:register` — fills the data columns of the module table in docs/legal/register.md from the labelled sections of each
 * module README (Data kept / Why each field / Exposure / Retention / Owners). The legal columns (basis, recipients, location) stay by hand in the
 * table above it. Only the block between the two markers is rewritten.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const START = '<!-- legal-register:start -->'
const END = '<!-- legal-register:end -->'
const LABELS = {
  kept: /^\*\*Data kept\.?\*\*/i,
  why: /^\*\*Why each field\.?\*\*/i,
  exposure: /^\*\*(Public exposure|Exposure)\.?\*\*/i,
  retention: /^\*\*Retention[^*]*\*\*/i,
  owners: /^\*\*Owners\.?\*\*/i,
} as const

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()

/** The text after a label, up to the next blank line. */
function section(text: string, label: RegExp): string {
  for (const block of text.split(/\n\s*\n/)) {
    const b = block.trim()
    const m = b.match(label)
    if (m) return clean(b.slice(m[0].length))
  }
  return '—'
}

const rows: string[] = []
for (const dir of readdirSync(join(root, 'modules')).sort()) {
  let readme: string
  try {
    readme = readFileSync(join(root, 'modules', dir, 'README.md'), 'utf8')
  } catch {
    continue
  }
  const title = readme.split('\n')[0]?.replace(/^#\s*/, '') ?? dir
  rows.push(
    `| ${clean(title)} | ${section(readme, LABELS.kept)} | ${section(readme, LABELS.why)} | ${section(readme, LABELS.exposure)} | ${section(readme, LABELS.retention)} | ${section(readme, LABELS.owners)} |`,
  )
}
const table = [
  '| Module | Données gardées | Pourquoi | Exposition | Conservation | Responsables |',
  '|---|---|---|---|---|---|',
  ...rows,
].join('\n')

const file = join(root, 'docs/legal/register.md')
let doc = readFileSync(file, 'utf8')
if (!doc.includes(START))
  doc += `\n## Par module (généré depuis les README des modules)\n\n${START}\n${END}\n`
doc = doc.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${table}\n${END}`)
writeFileSync(file, doc)
console.log(`${rows.length} modules written to docs/legal/register.md`)
