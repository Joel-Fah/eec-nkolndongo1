/**
 * Pexels placeholders (decision 0009, amended 2026-10-19). Photos with people are **dev-only**: they stand
 * in for parish photos while we design, and must never be presented as the parish in public. The
 * production build gets none of them (and their files are gitignored), so pages fall back to their
 * photo-less design until real, consented parish photos replace them.
 */
import data from '../content/placeholders.json'

export type Placeholder = (typeof data)[number] & {
  landscape?: boolean
  hero?: boolean
  /** false = imported for wide heroes only (no 480/800 portrait files). */
  portrait?: boolean
  width?: number
  height?: number
}

/** `landscape`: the 4:3 crop (only for photos imported with --landscape). */
export const photoSrc = (p: Placeholder, w: 480 | 800, ext: 'avif' | 'webp', landscape = false) =>
  `/placeholders/${p.set}/${p.id}-${landscape ? 'l-' : ''}${w}.${ext}`

/** Photos of people, only in `astro dev`. */
export function peoplePhotos(): Placeholder[] {
  if (!import.meta.env.DEV) return []
  return (data as Placeholder[]).filter(
    (p) => p.people && p.portrait !== false && p.replaceWith === null,
  )
}

/** Wide hero files (imported with --hero): the photo's own proportions, 1280 and 1920 px wide. */
export const heroSrc = (p: Placeholder, w: 1280 | 1920, ext: 'avif' | 'webp') =>
  `/placeholders/${p.set}/${p.id}-h-${w}.${ext}`

/**
 * Photos by Pexels id, in the order given, only in `astro dev` (with and without people alike: the files
 * are gitignored until the media library hosts our own photos). Unknown ids are skipped.
 */
export function photosById(ids: number[]): Placeholder[] {
  if (!import.meta.env.DEV) return []
  const all = data as Placeholder[]
  return ids.flatMap((id) => all.filter((p) => p.id === id && p.replaceWith === null))
}
