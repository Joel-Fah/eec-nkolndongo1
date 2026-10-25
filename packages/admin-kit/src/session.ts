import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from './api'

export type Me = {
  user: {
    id: string
    email: string
    name: string
    /** Profile picture URL (Google members). */
    image: string | null
    firstName: string
    lastName: string
    phone: string | null
    locale: 'fr' | 'en'
    theme: string
    status: string
  }
  isSuperAdmin: boolean
  roles: { role: string; groupId: string | null }[]
  permissions: string[]
  /** Module id → switched on? (feature flags) */
  modules: Record<string, boolean>
}

/** null = signed out. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await api<Me>('/me')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  },
  staleTime: 60_000,
  retry: false,
})

export const useMe = () => useQuery(meQuery)

/** UI only: hide what you can't do. The API is the authority. */
export const hasPermission = (me: Me | null | undefined, key: string) =>
  !!me && (me.permissions.includes('*') || me.permissions.includes(key))

export function useSessionActions() {
  const qc = useQueryClient()
  return {
    async signIn(email: string, password: string) {
      await api('/auth/sign-in/email', { body: { email, password } })
      // Not just invalidate: the cached "signed out" answer isn't observed on the login screen, so it would
      // never refetch and the guard would bounce back to /login. Fetch the fresh one now.
      await qc.fetchQuery({ ...meQuery, staleTime: 0 })
    },
    async signOut() {
      await api('/auth/sign-out', { body: {} })
      qc.clear()
      try {
        // The public header keeps a short-lived « who is signed in » answer for this tab: forget it.
        sessionStorage.removeItem('eec-badge')
      } catch {
        // storage blocked: nothing to forget
      }
    },
  }
}
