/**
 * The carte de Sainte-Cène (decision 0050). A card is proposed by the secretariat and approved by another person (the pasteur); the Elders
 * record the monthly visa and the contributions; the member declares an excuse; fee schedules are set in the admin. No amount is ever
 * shown to a member as a debt.
 */
import { id, timestamps, tz } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { date, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const communionCards = pgTable(
  'communion_cards',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** proposed (waiting for a second person) → active ⇄ suspended → withdrawn. */
    status: text('status', { enum: ['proposed', 'active', 'suspended', 'withdrawn'] })
      .notNull()
      .default('proposed'),
    /** Rotates when a card is issued again, so an old QR code stops working. */
    version: integer('version').notNull().default(1),
    /** The last day the card is valid (an issue is per civil year unless the secretariat says otherwise). */
    validUntil: date('valid_until', { mode: 'string' }).notNull(),
    proposedBy: uuid('proposed_by').references(() => user.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => user.id, { onDelete: 'set null' }),
    approvedAt: tz('approved_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('communion_cards_user_idx').on(t.userId)],
)

/** The Elders' signature of a month: one per card and month, never written by the member. */
export const communionVisas = pgTable(
  'communion_visas',
  {
    id: id(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => communionCards.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    signedBy: uuid('signed_by').references(() => user.id, { onDelete: 'set null' }),
    signedAt: tz('signed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('communion_visas_unique').on(t.cardId, t.month)],
)

/** The member says « excused » for a month. No reason is kept; the team can only see it. */
export const communionExcuses = pgTable(
  'communion_excuses',
  {
    id: id(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => communionCards.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('communion_excuses_unique').on(t.cardId, t.month)],
)

/** What is expected from an age band or a group, set in the admin. Never shown as a debt. */
export const communionFees = pgTable(
  'communion_fees',
  {
    id: id(),
    kind: text('kind', { enum: ['age', 'group'] }).notNull(),
    /** An age band (`18-25`…) or a group id. */
    key: text('key').notNull(),
    amountXaf: integer('amount_xaf').notNull(),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('communion_fees_unique').on(t.kind, t.key)],
)

/** The contributions the Elders received, month by month. Visible to the Elders, the secretariat and the treasurer only. */
export const communionContributions = pgTable(
  'communion_contributions',
  {
    id: id(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => communionCards.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amountXaf: integer('amount_xaf').notNull(),
    notedBy: uuid('noted_by').references(() => user.id, { onDelete: 'set null' }),
    notedAt: tz('noted_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('communion_contributions_unique').on(t.cardId, t.month),
    index('communion_contributions_month_idx').on(t.month),
  ],
)
