/**
 * `pnpm restore --file <backup.age | latest> --target <postgres url>` — restores a backup into an EMPTY database.
 *   AGE_IDENTITY (env) or --identity <file>: the private key, kept offline by Joël — never in git or CI.
 * Steps: refuse a non-empty target and refuse the live database; apply the repo's migrations; load the rows in
 * foreign-key order; check every table count against the backup's header. Prints counts, never data.
 */
import { readFile } from 'node:fs/promises'
import { AwsClient } from 'aws4fetch'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { envLocal } from '../env-local.ts'
import { clientFor, decryptWith, type Header, tableOrder } from './lib.ts'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}
const file = arg('--file')
const target = arg('--target') ?? process.env.RESTORE_DATABASE_URL
const identityFile = arg('--identity')
const identity = identityFile
  ? (await readFile(identityFile, 'utf8'))
      .trim()
      .split('\n')
      .filter((l) => l.startsWith('AGE-SECRET-KEY-'))[0]
  : process.env.AGE_IDENTITY
if (!file || !target || !identity)
  throw new Error('Usage: --file <backup|latest> --target <url> (--identity <file> | AGE_IDENTITY)')
const live = envLocal('DATABASE_URL_UNPOOLED')
if (
  live &&
  new URL(live).pathname === new URL(target).pathname &&
  new URL(live).host === new URL(target).host
)
  throw new Error('Refusing to restore over the live database. Use a new branch or database.')

let encrypted: Uint8Array
if (file === 'latest') {
  const endpoint = envLocal('AWS_ENDPOINT_URL_S3') as string
  const aws = new AwsClient({
    accessKeyId: envLocal('AWS_ACCESS_KEY_ID') as string,
    secretAccessKey: envLocal('AWS_SECRET_ACCESS_KEY') as string,
    region: envLocal('AWS_REGION') ?? 'auto',
    service: 's3',
  })
  const base = `${endpoint.replace(/\/$/, '')}/${envLocal('BACKUP_BUCKET') ?? 'eec-backups'}`
  const names = [
    ...(await (await aws.fetch(`${base}?list-type=2&prefix=db/`)).text()).matchAll(
      /<Key>([^<]+)<\/Key>/g,
    ),
  ]
    .map((m) => m[1] as string)
    .sort()
  const latest = names.at(-1)
  if (!latest) throw new Error('No backup found')
  console.log(`latest backup: ${latest}`)
  encrypted = new Uint8Array(await (await aws.fetch(`${base}/${latest}`)).arrayBuffer())
} else encrypted = new Uint8Array(await readFile(file))

const text = new TextDecoder().decode(await decryptWith(identity, encrypted))
const [first, ...rest] = text.trim().split('\n')
const header = JSON.parse(first as string) as Header
if (header.kind !== 'header') throw new Error('Not a backup file')
console.log(`backup of ${header.at}, ${Object.keys(header.tables).length} tables`)

const c = clientFor(target)
await c.connect()
try {
  const existing = Number(
    (
      await c.query(
        "select count(*)::int n from information_schema.tables where table_schema='public'",
      )
    ).rows[0]?.n,
  )
  if (existing > 0)
    throw new Error(`The target already has ${existing} tables: restore needs an empty database.`)
  await migrate(drizzle(c), {
    migrationsFolder: new URL('../../packages/db/migrations', import.meta.url).pathname,
  })
  console.log('schema created from the repo migrations')
  const order = (await tableOrder(c)).filter((t) => t in header.tables)
  const byTable = new Map<string, Record<string, unknown>[]>()
  for (const line of rest) {
    const { t, row } = JSON.parse(line) as { t: string; row: Record<string, unknown> }
    byTable.set(t, [...(byTable.get(t) ?? []), row])
  }
  await c.query('begin')
  for (const t of order) {
    for (const row of byTable.get(t) ?? []) {
      const cols = Object.keys(row)
      const values = cols.map((k) => {
        const v = row[k]
        // jsonb columns come back as objects/arrays: send them as JSON text.
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      })
      await c.query(
        `insert into "${t}" (${cols.map((k) => `"${k}"`).join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
        values,
      )
    }
  }
  await c.query('commit')
  let bad = 0
  for (const [t, n] of Object.entries(header.tables)) {
    const got = Number((await c.query(`select count(*)::int n from "${t}"`)).rows[0]?.n)
    if (got !== n) {
      bad++
      console.error(`MISMATCH ${t}: backup ${n}, restored ${got}`)
    }
  }
  console.log(
    bad
      ? `restore finished with ${bad} mismatch(es)`
      : 'restore verified: every table has the same number of rows as the backup',
  )
  if (bad) process.exitCode = 1
} finally {
  await c.end()
}
