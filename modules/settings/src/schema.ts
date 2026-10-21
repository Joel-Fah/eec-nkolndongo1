/** Parish settings: one row per section, each field with its value and whether it has been validated. */
import { updatedAt } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  /** parish | season */
  section: text('section').primaryKey(),
  /** { [field]: { value: string, validated: boolean } } — only validated values are ever public. */
  values: jsonb('values').notNull(),
  updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
})
