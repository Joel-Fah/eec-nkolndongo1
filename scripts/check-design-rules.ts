/**
 * Design rules that Biome can't express. Run by `pnpm lint` (scripts package). Exits 1 on a violation.
 *
 *  1. No one-sided borders (Joël: "strictly avoid"): border-t/b/s/e/l/r(-n), divide-x/y,
 *     border-top|bottom|left|right|inline-*|block-* in CSS. Use a full ring, a tint, spacing, or <Ornament>.
 *  2. No squircles: `corner-shape`.
 *
 * To document an exception, you can't: change the design instead (docs/design/design-language.md §3).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roots = [
  'apps/web/src',
  'apps/admin/src',
  'packages/ui/astro',
  'packages/ui/react',
  'packages/ui/styles',
]
const extensions = ['.astro', '.tsx', '.ts', '.css']

const rules: { name: string; pattern: RegExp }[] = [
  {
    name: 'one-sided border (utility)',
    pattern:
      /(?<![\w-])(?:[a-z0-9-]+:)*(?:border-(?:[tbselrxy])(?:-[\w./[\]-]+)?|divide-[xy](?:-[\w-]+)?)(?![\w-])/,
  },
  {
    name: 'one-sided border (CSS property)',
    pattern:
      /\bborder-(?:top|bottom|left|right|inline-start|inline-end|block-start|block-end)(?:-[a-z]+)?\s*:/,
  },
  { name: 'squircle (corner-shape)', pattern: /\bcorner-shape\b/ },
]

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist' && name !== 'paraglide') yield* walk(path)
    } else if (extensions.some((ext) => name.endsWith(ext))) yield path
  }
}

let violations = 0
for (const base of roots) {
  const dir = join(root, base)
  try {
    statSync(dir)
  } catch {
    continue
  }
  for (const file of walk(dir)) {
    if (file.endsWith('.gen.ts')) continue
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        for (const rule of rules) {
          if (rule.pattern.test(line)) {
            violations++
            console.error(`${relative(root, file)}:${index + 1}  ${rule.name}\n    ${line.trim()}`)
          }
        }
      })
  }
}

if (violations) {
  console.error(`\n${violations} design-rule violation(s). See docs/design/design-language.md §3.`)
  process.exit(1)
}
console.log('Design rules: OK')
