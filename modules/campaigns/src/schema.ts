/** Fête des Moissons campaigns (decision 0041): a goal, entries entered by the treasurer, validated by someone else. No donors. */
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    slug: text('slug').notNull(),
    /** draft | published */
    state: text('state').notNull().default('draft'),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    /** Plain text, paragraphs separated by a blank line. */
    descriptionFr: text('description_fr').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    startsOn: text('starts_on').notNull(),
    endsOn: text('ends_on').notNull(),
    goalXaf: integer('goal_xaf').notNull().default(0),
    coverMediaId: uuid('cover_media_id'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('campaigns_slug_idx').on(t.slug),
    index('campaigns_state_idx').on(t.state, t.startsOn),
  ],
)

/** One amount received. `validated` is what makes it public (as part of a total, never as a row). The note is internal. */
export const campaignProgress = pgTable(
  'campaign_progress',
  {
    id: id(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    amountXaf: integer('amount_xaf').notNull(),
    receivedOn: text('received_on').notNull(),
    note: text('note').notNull().default(''),
    validated: boolean('validated').notNull().default(false),
    validatedBy: uuid('validated_by').references(() => user.id, { onDelete: 'set null' }),
    validatedAt: tz('validated_at'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('campaign_progress_idx').on(t.campaignId, t.validated, t.receivedOn)],
)

/** An optional goal for one group of the campaign (encouragement, not a ranking). */
export const campaignGroupGoals = pgTable(
  'campaign_group_goals',
  {
    id: id(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    goalXaf: integer('goal_xaf').notNull().default(0),
  },
  (t) => [uniqueIndex('campaign_group_goals_idx').on(t.campaignId, t.groupId)],
)
