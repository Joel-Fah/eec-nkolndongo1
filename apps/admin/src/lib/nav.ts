import type { MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'

export type AdminItem = { id: string; icon: IconName; label: MessageKey }
export type AdminGroup = { id: string; label: MessageKey; items: AdminItem[] }

const item = (id: string, icon: IconName): AdminItem => ({
  id,
  icon,
  label: `admin.items.${id}` as MessageKey,
})

/** Sidebar groups (docs/product/navigation.md → Admin navigation). Items are placeholders for now. */
export const groups: AdminGroup[] = [
  {
    id: 'content',
    label: 'admin.groups.content',
    items: [
      item('news', 'book'),
      item('sermons', 'music'),
      item('bulletin', 'bible'),
      item('media', 'download'),
    ],
  },
  {
    id: 'parish',
    label: 'admin.groups.parish',
    items: [
      item('events', 'calendar'),
      item('departments', 'users'),
      item('services', 'church'),
      item('liturgy', 'sun'),
    ],
  },
  {
    id: 'members',
    label: 'admin.groups.members',
    items: [item('people', 'account'), item('roles', 'settings')],
  },
  { id: 'finance', label: 'admin.groups.finance', items: [item('giving', 'gift')] },
  {
    id: 'settings',
    label: 'admin.groups.settings',
    items: [
      item('parish', 'home'),
      item('modules', 'command'),
      item('audit', 'clock'),
      item('ui', 'heart'),
    ],
  },
]

export const allItems = groups.flatMap((g) => g.items)
