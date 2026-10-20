import { useLocale, useMe } from '@eec/admin-kit'
import { Card } from '@eec/ui/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Icon } from '../../components/Icon'
import { labelOf, navFor } from '../../lib/nav'

export const Route = createFileRoute('/_app/')({ component: Dashboard })

/** What this person can manage, grouped like the menu. */
function Dashboard() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const groups = navFor(me)
  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl">
          {me?.user.firstName
            ? t('common.greeting', { name: me.user.firstName })
            : t('admin.dashboard')}
        </h1>
        <p className="max-w-[62ch] text-lg text-ink-muted">{t('admin.dashboard_text')}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id}>
            <h2 className="text-xl">{t(g.label)}</h2>
            <ul className="grid gap-1">
              {g.items.map((i) => (
                <li key={i.id}>
                  <Link to={i.path} className="admin-dash-link">
                    <Icon name={i.icon} size={16} />
                    {labelOf(i, t, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
