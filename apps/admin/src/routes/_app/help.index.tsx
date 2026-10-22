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
        <ul className="grid gap-3 sm:grid-cols-2">
          {sort(GUIDES).map((g) => (
            <li key={g.slug}>
              <Link
                to="/help/$slug"
                params={{ slug: g.slug }}
                className="admin-panel flex items-center justify-between gap-3 no-underline"
              >
                <span className="font-medium">{g.title[locale]}</span>
                <Icon name="arrowRight" size={16} />
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {sort(MEMOS).map((g) => (
            <li key={g.slug}>
              <Link
                to="/help/$slug"
                params={{ slug: g.slug }}
                className="admin-panel flex items-center justify-between gap-3 no-underline"
              >
                <span className="font-medium">{g.title[locale]}</span>
                <Icon name="print" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
