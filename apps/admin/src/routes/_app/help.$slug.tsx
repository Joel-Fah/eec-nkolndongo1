import { useLocale } from '@eec/admin-kit'
import { Button, EmptyState } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Brand } from '../../components/Brand'
import { Icon } from '../../components/Icon'
import { Illustration } from '../../components/Illustration'
import { GUIDES, loadGuide, MEMOS } from '../../lib/help'
import { renderMarkdown } from '../../lib/markdown'

export const Route = createFileRoute('/_app/help/$slug')({ component: Guide })

function Guide() {
  const { slug } = Route.useParams()
  const { t, locale } = useLocale()
  const known = [...GUIDES, ...MEMOS].find((g) => g.slug === slug)
  const q = useQuery({
    queryKey: ['help', slug, locale],
    queryFn: async () => {
      const md = await loadGuide(slug, locale)
      return md ? renderMarkdown(md) : null
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
  if (q.isSuccess && (!q.data || !known))
    return (
      <EmptyState title={t('admin.help.not_found')} art={<Illustration />}>
        <Link className="btn btn-secondary" to="/help">
          {t('admin.help.back')}
        </Link>
      </EmptyState>
    )
  const isMemo = MEMOS.some((m) => m.slug === slug)
  return (
    <article className="help-article grid gap-4">
      <Brand className="help-letterhead" />
      <div className="help-actions flex flex-wrap items-center justify-between gap-2">
        <Link className="btn btn-ghost" to="/help">
          <Icon name="arrowLeft" size={16} />
          {t('admin.help.back')}
        </Link>
        {isMemo && (
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="print" size={16} />
            {t('admin.help.print')}
          </Button>
        )}
      </div>
      <h1 className="text-4xl">{q.data?.title ?? known?.title[locale] ?? ''}</h1>
      {/* The Markdown comes from this repository and is escaped by our renderer. */}
      <div className="help-body" dangerouslySetInnerHTML={{ __html: q.data?.html ?? '' }} />
    </article>
  )
}
