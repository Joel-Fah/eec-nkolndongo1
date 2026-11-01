/**
 * `pnpm backup` — dumps the database to an age-encrypted file and stores it in the backups bucket.
 *   --out <file>   write a local file instead of uploading (tests, manual copies)
 * Needs: DATABASE_URL_UNPOOLED, BACKUP_AGE_RECIPIENT (the PUBLIC key; the private one stays with Joël, offline),
 * and for the upload AWS_ENDPOINT_URL_S3 / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (BACKUP_BUCKET, default
 * eec-backups). Keeps the last 12 backups, deletes older ones. Prints counts, never data.
 */
import { writeFile } from 'node:fs/promises'
import { AwsClient } from 'aws4fetch'
import { envLocal } from '../env-local.ts'
import { clientFor, encryptTo, type Header, SKIP_TABLES, tableOrder } from './lib.ts'

const KEEP = 12
const url = envLocal('DATABASE_URL_UNPOOLED')
const recipient = envLocal('BACKUP_AGE_RECIPIENT')
if (!url || !recipient)
  throw new Error('DATABASE_URL_UNPOOLED and BACKUP_AGE_RECIPIENT are required')
const outIndex = process.argv.indexOf('--out')
const outFile = outIndex > -1 ? process.argv[outIndex + 1] : undefined

const c = clientFor(url)
await c.connect()
try {
  const tables = (await tableOrder(c)).filter((t) => !SKIP_TABLES.has(t))
  const migrations = Number(
    (
      await c
        .query('select count(*)::int n from drizzle.__drizzle_migrations')
        .catch(() => ({ rows: [{ n: 0 }] }))
    ).rows[0]?.n ?? 0,
  )
  const lines: string[] = []
  const counts: Record<string, number> = {}
  await c.query('begin isolation level repeatable read read only')
  for (const t of tables) {
    const { rows } = await c.query(`select * from "${t}"`)
    counts[t] = rows.length
    for (const row of rows) lines.push(JSON.stringify({ t, row }))
  }
  await c.query('commit')
  const header: Header = {
    kind: 'header',
    version: 1,
    at: new Date().toISOString(),
    migrations,
    tables: counts,
  }
  const body = new TextEncoder().encode(`${[JSON.stringify(header), ...lines].join('\n')}\n`)
  const encrypted = await encryptTo(recipient, body)
  const stamp = header.at.slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
  if (outFile) {
    await writeFile(outFile, encrypted)
    console.log(`backup written: ${outFile} (${(encrypted.length / 1024).toFixed(0)} KB)`)
  } else {
    const endpoint = envLocal('AWS_ENDPOINT_URL_S3')
    const key = envLocal('AWS_ACCESS_KEY_ID')
    const secret = envLocal('AWS_SECRET_ACCESS_KEY')
    if (!endpoint || !key || !secret)
      throw new Error('Object storage variables are missing for the upload')
    const bucket = envLocal('BACKUP_BUCKET') ?? 'eec-backups'
    const aws = new AwsClient({
      accessKeyId: key,
      secretAccessKey: secret,
      region: envLocal('AWS_REGION') ?? 'auto',
      service: 's3',
    })
    const base = `${endpoint.replace(/\/$/, '')}/${bucket}`
    const name = `db/eec-${stamp}.ndjson.gz.age`
    const put = await aws.fetch(`${base}/${name}`, { method: 'PUT', body: encrypted })
    if (!put.ok) {
      // Say what the store answered (a 403 is usually a key without write access to this bucket), never the keys.
      const why = (await put.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
      throw new Error(`upload failed: ${put.status} ${put.statusText} — bucket "${bucket}" ${why}`)
    }
    console.log(`backup uploaded: ${bucket}/${name} (${(encrypted.length / 1024).toFixed(0)} KB)`)
    // Tell the app (Admin → Santé reads « last backup age »). Never fails the backup: the table may not exist yet.
    await c
      .query(
        `insert into system_marks (key, at, note) values ('backup', now(), $1)
         on conflict (key) do update set at = now(), note = excluded.note`,
        [`${bucket}/${name}`],
      )
      .catch(() => {})
    // Keep the newest KEEP backups.
    const list = await (await aws.fetch(`${base}?list-type=2&prefix=db/`)).text()
    const names = [...list.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1] as string).sort()
    for (const old of names.slice(0, Math.max(0, names.length - KEEP))) {
      await aws.fetch(`${base}/${old}`, { method: 'DELETE' })
      console.log(`old backup removed: ${old}`)
    }
  }
  console.log(
    'rows per table:',
    Object.entries(counts)
      .filter(([, n]) => n)
      .map(([t, n]) => `${t}=${n}`)
      .join(' '),
  )
} finally {
  await c.end()
}
