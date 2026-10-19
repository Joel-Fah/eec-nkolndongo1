/**
 * Pexels placeholders (decision 0009, amended 2026-10-19). Photos with people are **dev-only**: they stand
 * in for parish photos while we design, and must never be presented as the parish in public. The
 * production build gets none of them (and their files are gitignored), so pages fall back to their
 * photo-less design until real, consented parish photos replace them.
 */
import data from '../content/placeholders.json'

export type Placeholder = (typeof data)[number] & { landscape?: boolean }

/** `landscape`: the 4:3 crop (only for photos imported with --landscape). */
export const photoSrc = (p: Placeholder, w: 480 | 800, ext: 'avif' | 'webp', landscape = false) =>
  `/placeholders/${p.set}/${p.id}-${landscape ? 'l-' : ''}${w}.${ext}`

/** Photos of people, only in `astro dev`. */
export function peoplePhotos(): Placeholder[] {
  if (!import.meta.env.DEV) return []
  return (data as Placeholder[]).filter((p) => p.people && p.replaceWith === null)
}
