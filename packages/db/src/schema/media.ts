/** The media library: one row per file (an image row lists its resized variants), and where each is used. */

import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, timestamps } from '../columns.ts'
import { user } from './auth.ts'

export type MediaVariant = { key: string; width: number; size: number; mime: string }

export const mediaFiles = pgTable(
  'media_files',
  {
    id: id(),
    /** image | audio | document */
    kind: text('kind').notNull(),
    mime: text('mime').notNull(),
    originalName: text('original_name').notNull(),
    /** Total bytes stored (all variants). */
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationS: integer('duration_s'),
    /** Images: the resized copies, smallest first. Audio and documents: a single entry. */
    variants: jsonb('variants').$type<MediaVariant[]>().notNull(),
    /** A tiny ThumbHash (base64), shown while the image loads. */
    placeholder: text('placeholder'),
    altFr: text('alt_fr'),
    altEn: text('alt_en'),
    captionFr: text('caption_fr'),
    captionEn: text('caption_en'),
    credit: text('credit'),
    creditUrl: text('credit_url'),
    /** upload | pexels */
    source: text('source').notNull().default('upload'),
    sourceId: text('source_id'),
    /** ready | archived */
    status: text('status').notNull().default('ready'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    index('media_files_created_idx').on(t.createdAt),
    index('media_files_kind_idx').on(t.kind, t.status),
  ],
)

/** Lets future modules say where a file is used, so deleting something in use is refused. */
export const mediaUsages = pgTable(
  'media_usages',
  {
    id: id(),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => mediaFiles.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    field: text('field').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('media_usages_media_idx').on(t.mediaId)],
)
