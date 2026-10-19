/**
 * WCAG contrast for every text/background token pair in both themes (packages/ui/src/tokens.ts).
 * Prints a table; exits 1 if any pair fails. Usage: pnpm contrast [--all]
 */
import { contrastReport } from '../packages/ui/src/contrast.ts'

const rows = contrastReport()
const showAll = process.argv.includes('--all')
const pad = (s: string, n: number) => s.padEnd(n)

console.log(
  `${pad('theme', 6)} ${pad('foreground', 26)} ${pad('background', 22)} ratio   min  result`,
)
for (const r of rows) {
  if (!showAll && r.pass && r.min > 1) continue
  const result = r.min <= 1 ? 'info' : r.pass ? 'pass' : 'FAIL'
  console.log(
    `${pad(r.theme, 6)} ${pad(`${r.fg} ${r.fgHex}`, 26)} ${pad(`${r.bg} ${r.bgHex}`, 22)} ${r.ratio.toFixed(2).padStart(5)}  ${String(r.min).padStart(4)}  ${result}`,
  )
}
const failing = rows.filter((r) => !r.pass)
console.log(
  `\n${rows.length} pairs checked — ${failing.length} failing${showAll ? '' : ' (use --all to list every pair)'}`,
)
process.exit(failing.length ? 1 : 0)
