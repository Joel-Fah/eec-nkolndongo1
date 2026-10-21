/**
 * Imports approved Pexels photos (decision 0009, amended 2026-10-19: photos with people allowed as
 * **dev-only** placeholders). Downloads each original once, writes 3:4 AVIF + WebP variants (480/800w) and a
 * tiny blurred placeholder into apps/web/public/placeholders/ (gitignored: never deployed, never committed),
 * and records credits in apps/web/src/content/placeholders.json (committed). The production build refuses
 * any placeholder with `people: true` (apps/web/src/lib/placeholders.ts).
 *
 * Usage: node --env-file=../.env.local pexels/import.ts --set people <id> <id> …
 *        add --landscape to also write 4:3 crops (<id>-l-480/800) for the given ids;
 *        add --hero for wide page heroes (<id>-h-1280/1920, the photo's own proportions);
 *        --set place for photos without people.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import type { PexelsPhoto } from './search.ts'

const { values, positionals } = parseArgs({
  options: {
    set: { type: 'string', default: 'people' },
    landscape: { type: 'boolean', default: false },
    hero: { type: 'boolean', default: false },
  },
  allowPositionals: true,
})
const key = process.env.PEXELS_API_KEY
if (!key) throw new Error('PEXELS_API_KEY missing (put it in .env.local)')
const set = values.set ?? 'people'
const root = join(import.meta.dirname, '../..')
const outDir = join(root, 'apps/web/public/placeholders', set)
const cacheDir = join(root, 'scripts/.cache/pexels/originals')
const manifestFile = join(root, 'apps/web/src/content/placeholders.json')
await mkdir(outDir, { recursive: true })
await mkdir(cacheDir, { recursive: true })

type Entry = {
  id: number
  set: string
  people: boolean
  alt: string
  photographer: string
  photographerUrl: string
  pexelsUrl: string
  color: string
  blur: string
  landscape?: boolean
  hero?: boolean
  width?: number
  height?: number
  replaceWith: string | null
}
const manifest: Entry[] = existsSync(manifestFile)
  ? JSON.parse(await readFile(manifestFile, 'utf8'))
  : []

/** 4:3 crop of the same photo, for the landscape cards of the hero stream. */
async function landscape(id: number, original: string) {
  const cropped = await sharp(original)
    .rotate()
    .resize({ width: 1067, height: 800, fit: 'cover', position: 'attention' })
    .toBuffer()
  for (const w of [480, 800]) {
    const sized = sharp(cropped).resize({ width: w })
    await sized
      .clone()
      .avif({ quality: 52, effort: 6 })
      .toFile(join(outDir, `${id}-l-${w}.avif`))
    await sized
      .clone()
      .webp({ quality: 72 })
      .toFile(join(outDir, `${id}-l-${w}.webp`))
  }
}

/** Pexels/CDN connections drop now and then: retry with a short back-off. */
async function get(url: string, init?: RequestInit, tries = 4): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (tries <= 1) throw error
    await new Promise((r) => setTimeout(r, 1500))
    return get(url, init, tries - 1)
  }
}

for (const id of positionals.map(Number)) {
  const known = manifest.find((m) => m.id === id)
  if (values.hero) {
    const photo: PexelsPhoto = known
      ? ({
          ...(await (
            await get(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: key } })
          ).json()),
        } as PexelsPhoto)
      : await (
          await get(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: key } })
        ).json()
    const big = join(cacheDir, `${id}-hero.jpg`)
    if (!existsSync(big)) {
      const img = await get(`${photo.src.original}?auto=compress&w=2400`)
      await writeFile(big, Buffer.from(await img.arrayBuffer()))
    }
    const meta = await sharp(big).rotate().metadata()
    for (const w of [1280, 1920]) {
      const sized = sharp(big).rotate().resize({ width: w })
      await sized
        .clone()
        .avif({ quality: 50, effort: 5 })
        .toFile(join(outDir, `${id}-h-${w}.avif`))
      await sized
        .clone()
        .webp({ quality: 70 })
        .toFile(join(outDir, `${id}-h-${w}.webp`))
    }
    const tiny = await sharp(big).rotate().resize({ width: 16 }).webp({ quality: 40 }).toBuffer()
    const entry: Entry = {
      ...(known ?? {
        id,
        set,
        people: set === 'people',
        alt: photo.alt,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
        color: photo.avg_color,
        replaceWith: null,
      }),
      blur: known?.blur ?? `data:image/webp;base64,${tiny.toString('base64')}`,
      hero: true,
      ...(known ? {} : { portrait: false }),
      width: meta.width,
      height: meta.height,
    } as Entry
    const i = manifest.findIndex((m) => m.id === id)
    if (i >= 0) manifest[i] = entry
    else manifest.push(entry)
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`✓ ${id} hero · ${photo.photographer}`)
    continue
  }
  if (known && existsSync(join(outDir, `${id}-800.webp`))) {
    if (values.landscape) {
      await landscape(id, join(cacheDir, `${id}.jpg`))
      known.landscape = true
      await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log(`✓ ${id} landscape`)
    }
    continue
  }
  const res = await get(`https://api.pexels.com/v1/photos/${id}`, {
    headers: { Authorization: key },
  })
  if (!res.ok) throw new Error(`Pexels ${res.status} for ${id}`)
  const photo: PexelsPhoto = await res.json()
  const original = join(cacheDir, `${id}.jpg`)
  if (!existsSync(original)) {
    const img = await get(`${photo.src.original}?auto=compress&w=1600`)
    await writeFile(original, Buffer.from(await img.arrayBuffer()))
  }
  // `attention` keeps faces and the busiest part of the frame in the crop.
  const base = sharp(original)
    .rotate()
    .resize({ width: 800, height: 1067, fit: 'cover', position: 'attention' })
  const cropped = await base.toBuffer()
  for (const w of [480, 800]) {
    const sized = sharp(cropped).resize({ width: w })
    await sized
      .clone()
      .avif({ quality: 52, effort: 6 })
      .toFile(join(outDir, `${id}-${w}.avif`))
    await sized
      .clone()
      .webp({ quality: 72 })
      .toFile(join(outDir, `${id}-${w}.webp`))
  }
  const tiny = await sharp(cropped).resize({ width: 12 }).webp({ quality: 40 }).toBuffer()
  const entry: Entry = {
    id,
    set,
    people: set === 'people',
    alt: photo.alt,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pexelsUrl: photo.url,
    color: photo.avg_color,
    blur: `data:image/webp;base64,${tiny.toString('base64')}`,
    replaceWith: null,
  }
  const i = manifest.findIndex((m) => m.id === id)
  if (i >= 0) manifest[i] = entry
  else manifest.push(entry)
  await mkdir(join(root, 'apps/web/src/content'), { recursive: true })
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`✓ ${id} · ${photo.photographer}`)
}
