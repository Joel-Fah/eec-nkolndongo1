/**
 * How to address a person: the display name when they chose one of their own, otherwise their first name. The display name is filled
 * with « first last » at sign-up, so a value equal to that is not a choice and gives way to the first name.
 */
export function callName(u: {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
}): string {
  const first = (u.firstName ?? '').trim()
  const display = (u.name ?? '').trim()
  const auto = [first, (u.lastName ?? '').trim()].filter(Boolean).join(' ')
  if (display && display !== auto) return display
  return first || display
}
