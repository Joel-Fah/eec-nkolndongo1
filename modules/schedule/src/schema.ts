/** The weekly rhythm (services, studies, prayer, office hours) and one-off changes to it. */
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const scheduleSlots = pgTable(
  'schedule_slots',
  {
    id: id(),
    kind: text('kind').notNull().default('culte'),
    labelFr: text('label_fr').notNull(),
    labelEn: text('label_en').notNull().default(''),
    /** 0 = Sunday … 6 = Saturday. */
    weekday: integer('weekday').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    placeFr: text('place_fr').notNull().default(''),
    placeEn: text('place_en').notNull().default(''),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    notesFr: text('notes_fr').notNull().default(''),
    notesEn: text('notes_en').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Nothing reaches the public site until someone allowed to approve has approved it (like the settings). */
    validated: boolean('validated').notNull().default(false),
    validatedBy: uuid('validated_by').references(() => user.id, { onDelete: 'set null' }),
    validatedAt: tz('validated_at'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('schedule_slots_week_idx').on(t.weekday, t.startTime)],
)

export const scheduleExceptions = pgTable(
  'schedule_exceptions',
  {
    id: id(),
    /** Local date, YYYY-MM-DD. */
    date: text('date').notNull(),
    /** null = every service that day. */
    slotId: uuid('slot_id').references(() => scheduleSlots.id, { onDelete: 'cascade' }),
    /** cancelled | changed | extra */
    kind: text('kind').notNull(),
    noteFr: text('note_fr').notNull().default(''),
    noteEn: text('note_en').notNull().default(''),
    startTime: text('start_time'),
    endTime: text('end_time'),
    labelFr: text('label_fr').notNull().default(''),
    labelEn: text('label_en').notNull().default(''),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('schedule_exceptions_date_idx').on(t.date)],
)
