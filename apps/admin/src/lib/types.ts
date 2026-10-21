/** Shapes returned by the admin API (apps/api/src/routes). */
export type Grant = {
  id: string
  roleKey: string
  roleFr: string
  roleEn: string | null
  groupId: string | null
  groupFr: string | null
  groupEn: string | null
}
export type UserRow = {
  id: string
  email: string
  name: string
  status: 'active' | 'invited' | 'deactivated'
  lastSeenAt: string | null
  createdAt: string
  roles: Grant[]
}
export type Role = {
  id: string
  key: string
  nameFr: string
  nameEn: string | null
  descriptionFr: string | null
  descriptionEn: string | null
  isSystem: boolean
  permissions: string[]
  users: number
}
export type Group = {
  id: string
  key: string
  nameFr: string
  nameEn: string | null
  kind: 'department' | 'committee' | 'choir' | 'other'
  descriptionFr: string | null
  descriptionEn: string | null
  isActive: boolean
  members: number
  leaders: { userId: string; name: string; email: string }[]
}
export const bi = (
  fr: string | null | undefined,
  en: string | null | undefined,
  locale: 'fr' | 'en',
) => (locale === 'en' ? en || fr : fr) ?? ''
