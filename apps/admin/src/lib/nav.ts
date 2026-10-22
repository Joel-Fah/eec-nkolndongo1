/**
 * The admin menu, built from the core entries + the module registry (Phase 02 §6.4), then filtered by what
 * the signed-in person may do and which modules are on. The API stays the authority; this only hides.
 */
import { hasPermission, type Me } from '@eec/admin-kit'
import type { Locale, MessageKey } from '@eec/i18n'
import { modules } from '@eec/modules'
import type { AdminNavEntry } from '@eec/modules-kit'
import type { IconName } from '@eec/ui/icons'

export type NavItem = {
  id: string
  path: string
  icon: IconName
  /** A message key (core) or a bilingual label (modules). */
  label: MessageKey | { fr: string; en: string }
  permission: string
  order: number
}
export type NavGroup = { id: AdminNavEntry['group']; label: MessageKey; items: NavItem[] }

const ORDER: AdminNavEntry['group'][] = [
  'content',
  'parish',
  'members',
  'finance',
  'admin',
  'settings',
]

const core: (NavItem & { group: AdminNavEntry['group'] })[] = [
  {
    id: 'users',
    group: 'admin',
    path: '/users',
    icon: 'users',
    label: 'admin.items.users',
    permission: 'core:users-read',
    order: 10,
  },
  {
    id: 'roles',
    group: 'admin',
    path: '/roles',
    icon: 'checklist',
    label: 'admin.items.roles',
    permission: 'core:roles-read',
    order: 20,
  },
  {
    id: 'teams',
    group: 'admin',
    path: '/groups',
    icon: 'department',
    label: 'admin.items.teams',
    permission: 'core:groups-read',
    order: 30,
  },
  {
    id: 'audit',
    group: 'admin',
    path: '/audit',
    icon: 'timeline',
    label: 'admin.items.audit',
    permission: 'core:audit-read',
    order: 40,
  },
  {
    id: 'validate',
    group: 'admin',
    path: '/validate',
    icon: 'shield',
    label: 'admin.items.validate',
    permission: 'core:validation-read',
    order: 50,
  },
  {
    id: 'health',
    group: 'settings',
    path: '/health',
    icon: 'pulse',
    label: 'admin.items.health',
    permission: 'core:system-health',
    order: 30,
  },
  {
    id: 'help',
    group: 'settings',
    path: '/help',
    icon: 'help',
    label: 'admin.items.help',
    permission: '',
    order: 10,
  },
  {
    id: 'outbox',
    group: 'settings',
    path: '/outbox',
    icon: 'mailSend',
    label: 'admin.items.outbox',
    permission: 'core:system-outbox',
    order: 20,
  },
  {
    id: 'ui',
    group: 'settings',
    path: '/ui',
    icon: 'canvas',
    label: 'admin.items.ui',
    permission: 'core:system-design',
    order: 90,
  },
]

export function navFor(me: Me | null | undefined): NavGroup[] {
  const fromModules = modules.flatMap((m) =>
    me?.modules?.[m.id] === false
      ? []
      : (m.admin?.nav ?? []).map((n) => ({
          id: `${m.id}:${n.path}`,
          group: n.group,
          path: n.path,
          icon: n.icon,
          label: n.label,
          permission: n.permission,
          order: n.order,
        })),
  )
  const visible = [...core, ...fromModules].filter(
    (i) => !i.permission || hasPermission(me, i.permission),
  )
  return ORDER.map((id) => ({
    id,
    label: `admin.groups.${id}` as MessageKey,
    items: visible.filter((i) => i.group === id).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length)
}

export const labelOf = (item: NavItem, t: (k: MessageKey) => string, locale: Locale) =>
  typeof item.label === 'string' ? t(item.label) : item.label[locale]
