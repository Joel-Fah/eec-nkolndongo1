/** What the library accepts, and how a file is recognised (by its first bytes, never by its name). */
export type MediaKind = 'image' | 'audio' | 'document'

export const LIMITS = {
  /** The source photo picked in the browser (it is resized there; only variants are uploaded). */
  imageOriginal: 15 * 1024 * 1024,
  /** One uploaded image variant. */
  imageVariant: 4 * 1024 * 1024,
  audio: 80 * 1024 * 1024,
  document: 20 * 1024 * 1024,
}
export const VARIANT_WIDTHS = [480, 960, 1600] as const

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v)
const ascii = (b: Uint8Array, text: string, at = 0) =>
  [...text].every((c, i) => b[at + i] === c.charCodeAt(0))

/** The type of a file from its first bytes; null when it is not something we accept. */
export function sniff(b: Uint8Array): { kind: MediaKind; mime: string; ext: string } | null {
  if (b.length < 12) return null
  if (ascii(b, 'RIFF') && ascii(b, 'WEBP', 8))
    return { kind: 'image', mime: 'image/webp', ext: 'webp' }
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' }
  if (ascii(b, '%PDF-')) return { kind: 'document', mime: 'application/pdf', ext: 'pdf' }
  if (ascii(b, 'ID3') || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0))
    return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' }
  if (ascii(b, 'ftyp', 4)) return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' }
  if (ascii(b, 'OggS')) return { kind: 'audio', mime: 'audio/ogg', ext: 'ogg' }
  if (ascii(b, 'RIFF') && ascii(b, 'WAVE', 8))
    return { kind: 'audio', mime: 'audio/wav', ext: 'wav' }
  return null
}

/** `<kind>/<yyyy>/<mm>/<id>/<variant>.<ext>` — the key is also the public path under /media/. */
export function mediaKey(
  kind: MediaKind,
  id: string,
  variant: string,
  ext: string,
  at = new Date(),
) {
  const yyyy = String(at.getUTCFullYear())
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0')
  return `${kind}/${yyyy}/${mm}/${id}/${variant}.${ext}`
}

/** A key the public route may serve (no listing, no climbing out of the folder). */
export const PUBLIC_KEY =
  /^(image|audio|document)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/[a-z0-9-]+\.[a-z0-9]+$/

export const MIME_BY_EXT: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
}

/** Parses an HTTP Range header (`bytes=0-99`, `bytes=100-`, `bytes=-50`) against a known size. */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start: number
  let end: number
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]))
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  return start <= end && start < size ? { start, end } : null
}
