/** Roles, permissions, groups and who has what (decision 0005; Phase 02 §5.1). */
import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, timestamps, tz } from '../columns.ts'
import { user } from './auth.ts'

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  phone: text('phone'),
  locale: text('locale', { enum: ['fr', 'en'] })
    .notNull()
    .default('fr'),
  theme: text('theme', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  status: text('status', { enum: ['active', 'invited', 'deactivated'] })
    .notNull()
    .default('active'),
  lastSeenAt: tz('last_seen_at'),
  /** Set when the person asked to delete their account (30-day grace, then purged). */
  deletionRequestedAt: tz('deletion_requested_at'),
  ...timestamps(),
})

export const roles = pgTable('roles', {
  id: id(),
  key: text('key').notNull().unique(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  isSystem: boolean('is_system').notNull().default(false),
  ...timestamps(),
})

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  module: text('module').notNull(),
  labelFr: text('label_fr').notNull(),
  labelEn: text('label_en'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  isDangerous: boolean('is_dangerous').notNull().default(false),
  /** Removed from a manifest: kept for history, never silently deleted. */
  deprecated: boolean('deprecated').notNull().default(false),
  createdAt: createdAt(),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
)

export const groups = pgTable('groups', {
  id: id(),
  key: text('key').notNull().unique(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en'),
  kind: text('kind', { enum: ['department', 'committee', 'choir', 'other'] })
    .notNull()
    .default('department'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps(),
})

/** A role granted to a user, optionally scoped to one group (null = global). */
export const userRoles = pgTable(
  'user_roles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => user.id, { onDelete: 'set null' }),
    grantedAt: tz('granted_at').notNull().defaultNow(),
    expiresAt: tz('expires_at'),
  },
  (t) => [
    index('user_roles_user_idx').on(t.userId),
    // one grant per (user, role, group); a global grant has group_id null
    uniqueIndex('user_roles_unique').on(
      t.userId,
      t.roleId,
      sql`coalesce(${t.groupId}, '00000000-0000-0000-0000-000000000000')`,
    ),
  ],
)

/** Membership is not permission: being in a group grants nothing by itself. */
export const groupMembers = pgTable(
  'group_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    titleFr: text('title_fr'),
    titleEn: text('title_en'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
)
