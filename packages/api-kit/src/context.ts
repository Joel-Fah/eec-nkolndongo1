import type { Auth, Principal } from '@eec/auth'
import type { Db } from '@eec/db'
import type { Env } from './env.ts'

/** Per-request services, created lazily so routes that don't need the database never open a connection. */
export type Deps = {
  db: () => Promise<Db>
  /** How long a public read may wait on the database: short behind Hyperdrive, longer for a direct dev connection. */
  timeoutMs: number
  /** A short-lived connection of its own, for work that outlives the response (cache refresh). */
  withDb: <R>(fn: (db: Db) => Promise<R>) => Promise<R>
  auth: () => Promise<Auth>
  /** The signed-in user's id (null if anonymous) and rights, loaded once per request. */
  actor: () => Promise<{ userId: string; principal: Principal } | null>
}

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } }
