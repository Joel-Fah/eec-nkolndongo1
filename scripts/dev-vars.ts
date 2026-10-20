/**
 * Writes apps/web/.dev.vars (gitignored) from .env.local, so the local Worker sees the same secrets.
 * Runs automatically before `pnpm dev`. Only the variables the Worker needs are copied.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, '.env.local')
if (!existsSync(src)) {
  console.error('Missing .env.local — run: neon env pull --branch dev --file .env.local')
  process.exit(1)
}
const env = Object.fromEntries(
  readFileSync(src, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^"|"$/g, ''),
    ]),
)
const wanted = [
  'DATABASE_URL_UNPOOLED',
  'AUTH_SECRET',
  'ADMIN_PATH',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'AWS_ENDPOINT_URL_S3',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'NEON_BRANCH',
]
const lines = wanted.filter((k) => env[k]).map((k) => `${k}="${env[k]}"`)
lines.push(`APP_ORIGIN="${env.APP_ORIGIN ?? 'http://localhost:8080'}"`)
writeFileSync(join(root, 'apps/web/.dev.vars'), `${lines.join('\n')}\n`)
console.log(
  `apps/web/.dev.vars written (${lines.length} variables, branch ${env.NEON_BRANCH ?? '?'})`,
)
