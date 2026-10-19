import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'
import { meQuery } from '../lib/session'

export const Route = createFileRoute('/_app')({
  // Signed-out visitors go to the login page; the API still checks every call.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/login' })
  },
  component: AppShell,
})
