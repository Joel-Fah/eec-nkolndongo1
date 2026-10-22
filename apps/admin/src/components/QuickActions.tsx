import { hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'
import { Link } from '@tanstack/react-router'
import { Icon } from './Icon'

type Action = {
  permission: string
  to: '/users' | '/outbox' | '/audit' | '/m/$module'
  params?: { module: string }
  icon: IconName
  label: MessageKey
}

const ACTIONS: (Action & { end?: boolean })[] = [
  {
    permission: 'media:upload',
    to: '/m/$module',
    params: { module: 'media' },
    icon: 'imageUp',
    label: 'dash.qa_upload',
  },
  { permission: 'core:users-invite', to: '/users', icon: 'userRoundPlus', label: 'dash.qa_invite' },
  {
    permission: 'members:read',
    to: '/m/$module',
    params: { module: 'members' },
    icon: 'couple',
    label: 'dash.qa_members',
  },
  { permission: 'core:system-outbox', to: '/outbox', icon: 'mailSend', label: 'dash.qa_outbox' },
  // Settings and activity sit together at the far end of the line.
  {
    permission: 'settings:read',
    to: '/m/$module',
    params: { module: 'settings' },
    icon: 'settings',
    label: 'dash.qa_settings',
    end: true,
  },
  {
    permission: 'core:audit-read',
    to: '/audit',
    icon: 'timeline',
    label: 'dash.qa_activity',
    end: true,
  },
]

/** The things people do most, one click away, only those the person is allowed to do. */
export function QuickActions() {
  const { t } = useLocale()
  const me = useMe().data
  const items = ACTIONS.filter((a) => hasPermission(me, a.permission))
  if (!items.length) return null
  return (
    <nav className="quick" aria-label={t('dash.quick')}>
      {items.map((a, i) => (
        <Link
          key={a.label}
          to={a.to}
          params={a.params as never}
          className="quick-action"
          data-end={a.end && !items[i - 1]?.end ? 'first' : a.end ? '' : undefined}
        >
          <span className="quick-icon" aria-hidden="true">
            <Icon name={a.icon} size={20} />
          </span>
          {t(a.label)}
        </Link>
      ))}
    </nav>
  )
}
