/** The log of data-rights requests from people without an account, or made by phone or in person (decision 0052). */
import { id, timestamps } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const rightsRequests = pgTable(
  'rights_requests',
  {
    id: id(),
    kind: text('kind', {
      enum: ['access', 'rectification', 'erasure', 'objection', 'other'],
    }).notNull(),
    /** Who asked: a name is enough to find the person; no more than needed. */
    name: text('name').notNull(),
    /** How to reach them to answer (a phone number or an e-mail), if they gave one. */
    contact: text('contact').notNull().default(''),
    channel: text('channel', { enum: ['phone', 'in_person', 'email', 'letter', 'site'] }).notNull(),
    receivedOn: date('received_on', { mode: 'string' }).notNull(),
    /** The legal deadline to answer (to confirm against the text of the law). */
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    status: text('status', { enum: ['received', 'in_progress', 'done', 'refused'] })
      .notNull()
      .default('received'),
    /** What was done, in a few words. Never the personal data itself. */
    outcome: text('outcome').notNull().default(''),
    closedOn: date('closed_on', { mode: 'string' }),
    handledBy: uuid('handled_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('rights_requests_status_idx').on(t.status, t.dueOn)],
)
