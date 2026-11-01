import type { Me } from '@eec/admin-kit'

/**
 * The roles to show for a person: « Responsable de groupe · Jeunesse ». « Membre » is everyone's, so it only shows when
 * it is all they have; the same role for several groups gives one line each.
 */
export function roleLabels(me: Me | null | undefined, locale: 'fr' | 'en') {
  const mine = me?.roles ?? []
  const shown = mine.filter((r) => r.role !== 'membre')
  return (shown.length ? shown : mine).map((r) => {
    const name = (locale === 'en' ? r.nameEn : r.nameFr) || r.role
    const group = locale === 'en' ? r.groupEn : r.groupFr
    return { key: `${r.role}:${r.groupId ?? ''}`, label: group ? `${name} · ${group}` : name }
  })
}
