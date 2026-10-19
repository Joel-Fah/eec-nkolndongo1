import { Badge, EmptyState } from '@eec/ui/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Illustration } from '../../components/Illustration'
import { useT } from '../../lib/locale'
import { allItems } from '../../lib/nav'

export const Route = createFileRoute('/_app/p/$id')({ component: Placeholder })

function Placeholder() {
  const t = useT()
  const { id } = Route.useParams()
  const item = allItems.find((i) => i.id === id)
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-4xl">{item ? t(item.label) : t('admin.dashboard')}</h1>
      <Badge tone="gold">{t('soon.badge')}</Badge>
      <EmptyState title={t('admin.soon_title')} text={t('admin.soon_text')} art={<Illustration />}>
        <Link to="/" className="btn btn-primary">
          {t('admin.dashboard')}
        </Link>
      </EmptyState>
    </div>
  )
}
