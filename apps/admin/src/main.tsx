import { LocaleProvider } from '@eec/admin-kit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PageLoading } from './components/Loading'
import { routeTree } from './routeTree.gen'
import './styles.css'

const queryClient = new QueryClient()
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPendingMs: 100,
  defaultPendingMinMs: 300,
  defaultPendingComponent: PageLoading,
  basepath: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LocaleProvider>
    </StrictMode>,
  )
}
