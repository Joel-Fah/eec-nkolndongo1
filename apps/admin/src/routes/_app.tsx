import { meQuery } from '@eec/admin-kit'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'

export const Route = createFileRoute('/_app')({
  // Signed-out visitors go to the login page; the API still checks every call.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/login' })
    // A team member who signs in with Google only chooses a password first (decision 0053).
    if (me.needsPassword) throw redirect({ to: '/set-password' })
    // A signed-in member (no permission at all) gets the plain 404: the admin does not announce itself.
    if (!me.isSuperAdmin && me.permissions.length === 0) throw notFound()
  },
  component: AppShell,
})
