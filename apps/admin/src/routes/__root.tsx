import { useT } from '@eec/admin-kit'
import { Toaster } from '@eec/ui/react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ErrorScreen } from '../components/ErrorScreen'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: () => <ErrorScreen />,
  errorComponent: ({ reset }) => <ErrorScreen kind="error" reset={reset} />,
})

function Root() {
  const t = useT()
  return (
    <>
      <Outlet />
      <Toaster closeLabel={t('ui.close')} />
    </>
  )
}
