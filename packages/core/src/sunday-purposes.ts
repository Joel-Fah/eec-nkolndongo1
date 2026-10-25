/**
 * What a Sunday's offering is for (decision 0043). The recurring ones are presets; anything else is typed freely, and stored as the
 * text itself. A preset is stored by its key, so it reads in either language.
 */
export const SUNDAY_PURPOSES = [
  { key: 'ordinaire', fr: 'Offrande ordinaire', en: 'Ordinary offering' },
  { key: 'dime', fr: 'Dîme', en: 'Tithe' },
  { key: 'travaux', fr: 'Travaux', en: 'Building works' },
  { key: 'moissons', fr: 'Moissons', en: 'Harvest festival' },
  { key: 'reconnaissance', fr: 'Action de grâce', en: 'Thanksgiving' },
  { key: 'autre', fr: 'Autre', en: 'Other' },
] as const
export type SundayPurposeKey = (typeof SUNDAY_PURPOSES)[number]['key']

export const isPresetPurpose = (p: string): p is SundayPurposeKey =>
  SUNDAY_PURPOSES.some((x) => x.key === p)
/** The words for a stored purpose: a preset in the reader's language, a free one as typed. */
export const purposeLabel = (purpose: string, locale: 'fr' | 'en') =>
  SUNDAY_PURPOSES.find((x) => x.key === purpose)?.[locale] ?? purpose
