import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as schema from './schema/index.ts'

export * as schema from './schema/index.ts'
export type Db = NodePgDatabase<typeof schema> & { $client: Client }

export type Connection = { db: Db; close: () => Promise<void> }

/**
 * One client per request (Workers can't share sockets between requests).
 * In production `connectionString` is Hyperdrive's (pooling + latency); locally it's the direct Neon URL.
 */
export async function connect(connectionString: string, attempts = 3): Promise<Connection> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    // Neon's compute may be waking up (it sleeps after 5 idle minutes): a short timeout + retry beats a hang.
    const client = new Client({ connectionString, connectionTimeoutMillis: 8000 })
    try {
      await client.connect()
      return { db: drizzle(client, { schema, casing: 'snake_case' }), close: () => client.end() }
    } catch (error) {
      lastError = error
      await client.end().catch(() => {})
    }
  }
  throw lastError
}
