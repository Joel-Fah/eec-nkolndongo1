/**
 * Pexels search for curation (decision 0009). Caches every response in scripts/.cache/pexels/ and writes
 * a contact sheet (HTML) to review the candidates visually. The live site never calls Pexels.
 *
 * Usage: node --env-file=../.env.local pexels/search.ts --q "african church choir" [--per-page 30]
 *        [--orientation portrait|landscape|square]
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    q: { type: 'string', multiple: true },
    'per-page': { type: 'string', default: '30' },
    orientation: { type: 'string', default: 'portrait' },
  },
})
const key = process.env.PEXELS_API_KEY
if (!key) throw new Error('PEXELS_API_KEY missing (put it in .env.local)')
if (!values.q?.length) throw new Error('Pass at least one --q')

export type PexelsPhoto = {
  id: number
  width: number
  height: number
  url: string
  alt: string
  avg_color: string
  photographer: string
  photographer_url: string
  src: { original: string; large2x: string; large: string; medium: string }
}

const cacheDir = join(import.meta.dirname, '../.cache/pexels')
await mkdir(cacheDir, { recursive: true })

const all = new Map<number, PexelsPhoto & { query: string }>()
for (const q of values.q) {
  const slug = `${q.replace(/\W+/g, '-')}-${values.orientation}-${values['per-page']}`
  const file = join(cacheDir, `${slug}.json`)
  let body: { photos: PexelsPhoto[] }
  if (existsSync(file)) body = JSON.parse(await readFile(file, 'utf8'))
  else {
    const url = new URL('https://api.pexels.com/v1/search')
    url.search = new URLSearchParams({
      query: q,
      per_page: values['per-page'] ?? '30',
      orientation: values.orientation ?? 'portrait',
    }).toString()
    const res = await fetch(url, { headers: { Authorization: key } })
    if (!res.ok) throw new Error(`Pexels ${res.status} for "${q}"`)
    body = await res.json()
    await writeFile(file, JSON.stringify(body))
  }
  for (const photo of body.photos) all.set(photo.id, { ...photo, query: q })
}

const sheet = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:12px sans-serif;display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${[
  ...all.values(),
]
  .map(
    (p) =>
      `<figure style="margin:0;position:relative"><img src="${p.src.medium}" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block"><figcaption style="position:absolute;left:2px;top:2px;background:#fff;padding:1px 4px;font-weight:700">${p.id}</figcaption></figure>`,
  )
  .join('')}</body>`
await writeFile(join(cacheDir, 'sheet.html'), sheet)
await writeFile(join(cacheDir, 'last.json'), JSON.stringify([...all.values()]))
console.log(`${all.size} candidates → scripts/.cache/pexels/sheet.html`)
