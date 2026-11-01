/** Short messages from a group's leaders to the group's members (decision 0049). */
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const announcementsItems = pgTable(
  'announcements_items',
  {
    id: id(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    titleFr: text('title_fr').notNull(),
    titleEn: text('title_en'),
    bodyFr: text('body_fr').notNull(),
    bodyEn: text('body_en'),
    /** An optional address (an event page, a form): a relative path of the site or an https address. */
    linkUrl: text('link_url'),
    state: text('state', { enum: ['draft', 'published', 'expired'] })
      .notNull()
      .default('draft'),
    publishedAt: tz('published_at'),
    expiresAt: tz('expires_at'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('announcements_group_idx').on(t.groupId, t.state)],
)
