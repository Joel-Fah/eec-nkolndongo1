import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from './api'

export type Me = {
  user: {
    id: string
    email: string
    name: string
    firstName: string
    lastName: string
    locale: 'fr' | 'en'
    theme: string
    status: string
  }
  isSuperAdmin: boolean
  roles: { role: string; groupId: string | null }[]
  permissions: string[]
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
      await qc.invalidateQueries({ queryKey: ['me'] })
    },
    async signOut() {
      await api('/auth/sign-out', { body: {} })
      qc.clear()
    },
  }
}
