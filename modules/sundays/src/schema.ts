/** Sunday reports (decision 0043): attendance counts and offering lines per Sunday. Aggregates only: no person, no donor. */
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const sundayReports = pgTable(
  'sunday_reports',
  {
    id: id(),
    /** The Sunday (YYYY-MM-DD). No foreign key to liturgy: either module can be switched off. */
    sundayDate: text('sunday_date').notNull(),
    /** Which service of that Sunday (1, 2, 3…): a Sunday may have several, each with its own counts and offerings. */
    position: integer('position').notNull().default(1),
    /** A name for it when there are several (« 2e culte », « Culte en anglais »). */
    serviceName: text('service_name').notNull().default(''),
    men: integer('men'),
    women: integer('women'),
    children: integer('children'),
    /** ordinary | special: a special Sunday carries its own words (« Réformation »). */
    serviceKind: text('service_kind').notNull().default('ordinary'),
    serviceLabel: text('service_label').notNull().default(''),
    /** Internal. Must not name anyone. */
    note: text('note').notNull().default(''),
    attendanceBy: uuid('attendance_by').references(() => user.id, { onDelete: 'set null' }),
    attendanceAt: tz('attendance_at'),
    /** Once closed, nothing changes without reopening. */
    closed: boolean('closed').notNull().default(false),
    closedBy: uuid('closed_by').references(() => user.id, { onDelete: 'set null' }),
    closedAt: tz('closed_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('sunday_reports_date_idx').on(t.sundayDate, t.position)],
)

export const sundayOfferings = pgTable(
  'sunday_offerings',
  {
    id: id(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => sundayReports.id, { onDelete: 'cascade' }),
    /** A preset key (`ordinaire`, `dime`…) or free text. */
    purpose: text('purpose').notNull(),
    amountXaf: integer('amount_xaf').notNull(),
    /** Null = the congregation. */
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    /** A « moissons » line may name a campaign; `progressId` is the unvalidated entry it created there (no foreign key: other module). */
    campaignId: uuid('campaign_id'),
    progressId: uuid('progress_id'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('sunday_offerings_report_idx').on(t.reportId)],
)
