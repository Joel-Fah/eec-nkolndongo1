import { hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/kit'
import { GUIDES, MEMOS } from '../../lib/help'

export const Route = createFileRoute('/_app/help/')({ component: HelpIndex })

function HelpIndex() {
  const { t, locale } = useLocale()
  const me = useMe().data
  // Guides that match what the person can do come first.
  const rank = (g: { permission?: string }) =>
    !g.permission || hasPermission(me, g.permission) ? 0 : 1
  const sort = <T extends { permission?: string }>(l: T[]) =>
    [...l].sort((a, b) => rank(a) - rank(b))
  return (
    <div className="grid gap-8">
      <PageHeader title={t('admin.help.title')} lead={t('admin.help.lead')} />
      <section className="grid gap-3" aria-labelledby="help-guides">
        <h2 id="help-guides" className="text-xl">
          {t('admin.help.guides')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sort(GUIDES).map((g) => (
            <li key={g.slug}>
              <Link to="/help/$slug" params={{ slug: g.slug }} className="help-grid-card">
                <span className="help-grid-icon" aria-hidden="true">
                  <Icon name={g.icon} size={24} />
                </span>
                <span className="font-display text-xl">{g.title[locale]}</span>
                <span className="text-sm text-ink-muted">{g.summary[locale]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3" aria-labelledby="help-memos">
        <h2 id="help-memos" className="text-xl">
          {t('admin.help.memos')}
        </h2>
        <p className="text-sm text-ink-muted">{t('admin.help.memos_help')}</p>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sort(MEMOS).map((g) => (
            <li key={g.slug}>
              <Link to="/help/$slug" params={{ slug: g.slug }} className="help-grid-card">
                <span className="help-grid-icon" aria-hidden="true">
                  <Icon name={g.icon} size={24} />
                </span>
                <span className="font-display text-xl">{g.title[locale]}</span>
                <span className="text-sm text-ink-muted">{g.summary[locale]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
