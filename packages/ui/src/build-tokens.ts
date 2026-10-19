import { writeFile } from 'node:fs/promises'
import { renderTokensCss } from './tokens-css.ts'

await writeFile(new URL('../tokens.css', import.meta.url), renderTokensCss())
console.log('packages/ui/tokens.css written')
