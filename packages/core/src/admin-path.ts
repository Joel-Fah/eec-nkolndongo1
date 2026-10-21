/**
 * Where the admin lives (ADMIN_PATH). Configurable so nobody stumbles on /admin/ by accident, and tolerant
 * so a typo in production cannot break it: « gestion », « gestion/ », « /gestion » and « /gestion/ » all
 * mean the same thing. Letters are lower-cased; only a-z, 0-9, « - » and « _ » are kept per segment.
 */
const RESERVED = new Set([
  'api',
  'fr',
  'en',
  'media',
  '_astro',
  'placeholders',
  'illustrations',
  'favicon.ico',
  'robots.txt',
])
const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/

/** `"/Gestion/"` → `"gestion"`; nested paths keep their slashes (`"a/b"`). Throws on nonsense. */
export function normalizeAdminPath(raw?: string | null): string {
  const cleaned = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
  if (!cleaned) return 'admin'
  const segments = cleaned.split('/')
  if (!segments.every((s) => SEGMENT.test(s)))
    throw new Error(
      `ADMIN_PATH "${raw}" is not valid: use letters, digits, "-" or "_" (e.g. "gestion" or "/gestion/").`,
    )
  if (RESERVED.has(segments[0] as string))
    throw new Error(`ADMIN_PATH "${raw}" is reserved by the site: pick another word.`)
  return cleaned
}

/** `"/gestion"` (no trailing slash): router basepath, link prefix. */
export const adminPrefix = (raw?: string | null) => `/${normalizeAdminPath(raw)}`
/** `"/gestion/"`: the Vite `base`. */
export const adminBase = (raw?: string | null) => `${adminPrefix(raw)}/`
