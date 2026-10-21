/**
 * Hero figures. **Facts, so they need validating** (docs/content): `value` stays null until the content
 * partner confirms it, and a null figure is not shown in production. In `astro dev` the `example` is shown
 * with an « exemple » tag so the layout can be judged. Moves to the settings module (admin-editable).
 */
export type Stat = {
  id: 'years' | 'groups' | 'sundays' | 'members'
  value: number | null
  example: number
  suffix?: string
}

export const stats: Stat[] = [
  { id: 'years', value: null, example: 60, suffix: '+' },
  { id: 'groups', value: null, example: 12 },
  { id: 'sundays', value: null, example: 52 },
  { id: 'members', value: null, example: 480, suffix: '+' },
]

export const visibleStats = () =>
  stats
    .map((s) => ({
      ...s,
      shown: s.value ?? (import.meta.env.DEV ? s.example : null),
      isExample: s.value === null,
    }))
    .filter((s): s is typeof s & { shown: number } => s.shown !== null)
