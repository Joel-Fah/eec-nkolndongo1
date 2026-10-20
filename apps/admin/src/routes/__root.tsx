import { useT } from '@eec/admin-kit'
import { Toaster } from '@eec/ui/react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
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
