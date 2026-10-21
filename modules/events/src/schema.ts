/** Events (Agenda): one-off or repeating, bilingual, with a lifecycle and an optional owning group. */
import type { Exception, Recurrence } from '@eec/core'
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const eventsItems = pgTable(
  'events_items',
  {
    id: id(),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    slug: text('slug').notNull(),
    /** draft | published | archived. « Scheduled » is `published` with a future `publish_at`. */
    state: text('state').notNull().default('draft'),
    publishAt: tz('publish_at'),
    unpublishAt: tz('unpublish_at'),
    firstPublishedAt: tz('first_published_at'),
    featured: boolean('featured').notNull().default(false),
    /** What kind of event (culte, étude, fête…): one icon and colour per kind. */
    kind: text('kind').notNull().default('autre'),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    descriptionFr: jsonb('description_fr').notNull().default({ type: 'doc', content: [] }),
    descriptionEn: jsonb('description_en').notNull().default({ type: 'doc', content: [] }),
    /** First occurrence. Repeating events keep the local time of day of this instant. */
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at'),
    allDay: boolean('all_day').notNull().default(false),
    timezone: text('timezone').notNull().default('Africa/Douala'),
    recurrence: jsonb('recurrence').$type<Recurrence | null>(),
    exceptions: jsonb('exceptions').$type<Exception[]>().notNull().default([]),
    /** temple | other */
    locationKind: text('location_kind').notNull().default('temple'),
    locationFr: text('location_fr').notNull().default(''),
    locationEn: text('location_en').notNull().default(''),
    registrationUrl: text('registration_url'),
    coverMediaId: uuid('cover_media_id'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('events_items_slug_idx').on(t.slug),
    index('events_items_list_idx').on(t.state, t.startsAt),
    index('events_items_group_idx').on(t.groupId),
  ],
)
