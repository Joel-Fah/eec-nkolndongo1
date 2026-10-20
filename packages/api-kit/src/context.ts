import type { Auth, Principal } from '@eec/auth'
import type { Db } from '@eec/db'
import type { Env } from './env.ts'

/** Per-request services, created lazily so routes that don't need the database never open a connection. */
export type Deps = {
  db: () => Promise<Db>
  auth: () => Promise<Auth>
  /** The signed-in user's id (null if anonymous) and rights, loaded once per request. */
  actor: () => Promise<{ userId: string; principal: Principal } | null>
}

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } }
