/** News posts: bilingual (French required, English optional), with a lifecycle and an optional owning group. */
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const newsPosts = pgTable(
  'news_posts',
  {
    id: id(),
    /** The group (department) that owns the post; group-scoped editors can only touch their own. */
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    slug: text('slug').notNull(),
    /** draft | published | archived. « Scheduled » is `published` with a future `publish_at`. */
    state: text('state').notNull().default('draft'),
    publishAt: tz('publish_at'),
    unpublishAt: tz('unpublish_at'),
    /** The first time it went live (for « published on » and the feed order when no date was set). */
    firstPublishedAt: tz('first_published_at'),
    pinned: boolean('pinned').notNull().default(false),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    excerptFr: text('excerpt_fr').notNull().default(''),
    excerptEn: text('excerpt_en').notNull().default(''),
    /** Rich-text documents (packages/core richtext). */
    bodyFr: jsonb('body_fr').notNull().default({ type: 'doc', content: [] }),
    bodyEn: jsonb('body_en').notNull().default({ type: 'doc', content: [] }),
    /** Library photo; the usage is recorded so it cannot be deleted while in use. */
    coverMediaId: uuid('cover_media_id'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('news_posts_slug_idx').on(t.slug),
    index('news_posts_list_idx').on(t.state, t.publishAt),
    index('news_posts_group_idx').on(t.groupId),
  ],
)
