import { useLocale, useMe } from '@eec/admin-kit'
import { moduleById } from '@eec/modules'
import { moduleAdmin } from '@eec/modules/admin'
import { EmptyState } from '@eec/ui/react'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { Illustration } from '../../components/Illustration'
import { Gate } from '../../components/kit'

export const Route = createFileRoute('/_app/m/$module')({ component: ModulePage })

/** A module's admin screen, from the registry (loaded on demand). Off or unknown → a plain "not here". */
function ModulePage() {
  const { t } = useLocale()
  const me = useMe().data
  const { module } = Route.useParams()
  const m = moduleById(module)
  const Page = moduleAdmin[module]
  const entry = m?.admin?.nav[0]
  if (!m || !Page || !entry || me?.modules?.[module] === false)
    return <EmptyState title={t('notfound.title')} art={<Illustration name="destination" />} />
  return (
    <Gate permission={entry.permission}>
      <Suspense fallback={<span className="skeleton h-64" aria-busy="true" />}>
        <Page />
      </Suspense>
    </Gate>
  )
}
