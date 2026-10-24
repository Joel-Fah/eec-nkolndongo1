import { is } from 'drizzle-orm'
import { getTableConfig, type PgTable, PgTable as PgTableClass } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from './schema/index.ts'

const tables = Object.values(schema).filter((v) => is(v, PgTableClass)) as PgTable[]
const config = tables.map((t) => getTableConfig(t))

describe('schema conventions', () => {
  it('finds the tables', () => expect(config.length).toBeGreaterThan(12))

  it('uses snake_case for tables and columns', () => {
    const bad = config
      .flatMap((t) => [t.name, ...t.columns.map((c) => `${t.name}.${c.name}`)])
      .filter((n) => !/^[a-z][a-z0-9_.]*$/.test(n))
    expect(bad).toEqual([])
  })

  it('every table records when it was created, except pure join/counter tables', () => {
    const exempt = new Set([
      'role_permissions',
      'user_roles',
      'profiles',
      'rate_limit',
      'retention_runs',
      'settings_flags',
      'consents',
      // counter (per-area version, updated_at only)
      'content_versions',
      // their own timestamp is the creation (checked_at) or the fact itself (at)
      'system_health',
      'system_marks',
    ])
    const missing = config
      .filter((t) => !exempt.has(t.name) && !t.columns.some((c) => c.name === 'created_at'))
      .map((t) => t.name)
    expect(missing).toEqual([])
  })

  it('never stores secrets in plain columns named like tokens', () => {
    const risky = config
      .flatMap((t) => t.columns.map((c) => `${t.name}.${c.name}`))
      .filter((n) => /(^|\.)(token|secret|api_key)$/.test(n))
    // session.token is Better Auth's opaque session id; everything else must be hashed (token_hash).
    expect(risky).toEqual(['session.token'])
  })
})
