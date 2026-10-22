/** Messages sent through the contact form, and the team's internal notes on them. */
import { id, timestamps, tz } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    /** renseignement | vie_pratique | departements | priere | autre */
    category: text('category').notNull(),
    /** What the visitor was looking at (a guide's title…), free text, optional. */
    subject: text('subject').notNull().default(''),
    message: text('message').notNull(),
    /** A prayer request: visible only with contact:read-sensitive, never exported, shorter retention. */
    sensitive: boolean('sensitive').notNull().default(false),
    /** new | progress | handled */
    status: text('status').notNull().default('new'),
    assignedTo: uuid('assigned_to').references(() => user.id, { onDelete: 'set null' }),
    handledAt: tz('handled_at'),
    /** When the visitor ticked the consent box (never pre-ticked). */
    consentAt: tz('consent_at').notNull(),
    ...timestamps(),
  },
  (t) => [index('contact_messages_status_idx').on(t.status, t.createdAt)],
)

export const contactNotes = pgTable(
  'contact_notes',
  {
    id: id(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => contactMessages.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => user.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    ...timestamps(),
  },
  (t) => [index('contact_notes_message_idx').on(t.messageId)],
)
