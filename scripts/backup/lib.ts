/**
 * Shared by backup.ts and restore.ts. The backup is a logical dump of the `public` schema as NDJSON (one line
 * per row), gzipped and encrypted with age: no pg_dump needed, readable by the same Node runtime that runs the
 * rest of the repo. The schema itself is the repo's migrations, so a restore = migrate an empty database, then
 * load the rows (decision 0022). Ephemeral tables (sessions, tokens, rate limits) are not backed up.
 */
import { gunzipSync, gzipSync } from 'node:zlib'
import { Decrypter, Encrypter } from 'age-encryption'
import pg from 'pg'

export const SKIP_TABLES = new Set([
  'session',
  'verification',
  'rate_limit',
  '__drizzle_migrations',
])

export type Header = {
  kind: 'header'
  version: 1
  at: string
  migrations: number
  tables: Record<string, number>
}

export const clientFor = (url: string) =>
  new pg.Client({ connectionString: url, connectionTimeoutMillis: 30_000 })

/** Tables of `public` in an order where every table comes after the ones it references. */
export async function tableOrder(c: pg.Client): Promise<string[]> {
  const tables = (
    await c.query<{ t: string }>(
      "select table_name as t from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    )
  ).rows.map((r) => r.t)
  const edges = (
    await c.query<{ child: string; parent: string }>(`
      select cl.relname as child, pr.relname as parent
      from pg_constraint k
      join pg_class cl on cl.oid = k.conrelid
      join pg_class pr on pr.oid = k.confrelid
      join pg_namespace n on n.oid = cl.relnamespace
      where k.contype = 'f' and n.nspname = 'public' and cl.relname <> pr.relname`)
  ).rows
  const deps = new Map(tables.map((t) => [t, new Set<string>()]))
  for (const e of edges) deps.get(e.child)?.add(e.parent)
  const order: string[] = []
  const left = new Set(tables)
  while (left.size) {
    const ready = [...left].filter((t) => [...(deps.get(t) ?? [])].every((d) => !left.has(d)))
    if (!ready.length) throw new Error(`Foreign-key cycle between: ${[...left].join(', ')}`)
    for (const t of ready.sort()) {
      order.push(t)
      left.delete(t)
    }
  }
  return order
}

export async function encryptTo(recipient: string, data: Uint8Array): Promise<Uint8Array> {
  const e = new Encrypter()
  e.addRecipient(recipient)
  return e.encrypt(gzipSync(data))
}

export async function decryptWith(identity: string, data: Uint8Array): Promise<Uint8Array> {
  const d = new Decrypter()
  d.addIdentity(identity)
  return gunzipSync(await d.decrypt(data))
}
