/** Shared column helpers: every table follows the same conventions (docs: Phase 02 §3). */
import { sql } from 'drizzle-orm'
import { timestamp, uuid } from 'drizzle-orm/pg-core'

export const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`)

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() })

export const tz = (name: string) => timestamp(name, { withTimezone: true })
