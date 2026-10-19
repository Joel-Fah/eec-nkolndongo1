import { Card } from '@eec/ui/react'
import { createFileRoute } from '@tanstack/react-router'
import { Icon } from '../../components/Icon'
import { useT } from '../../lib/locale'
import { groups } from '../../lib/nav'

export const Route = createFileRoute('/_app/')({ component: Dashboard })

function Dashboard() {
  const t = useT()
  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl">{t('admin.dashboard')}</h1>
        <p className="max-w-[62ch] text-lg text-ink-muted">{t('admin.dashboard_text')}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id}>
            <h2 className="text-xl">{t(g.label)}</h2>
            <ul className="grid gap-1 text-ink-muted">
              {g.items.map((i) => (
                <li key={i.id} className="flex items-center gap-2">
                  <Icon name={i.icon} size={16} />
                  {t(i.label)}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
