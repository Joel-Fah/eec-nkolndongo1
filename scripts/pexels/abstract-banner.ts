/**
 * Fetches one abstract Pexels photo (no people) for the admin's Design guide banner and writes it, resized and re-encoded, to
 * apps/admin/public/design-banner.webp plus a small credit file (both git-ignored: like the illustrations, fetched on demand).
 * Decision 0009: the live site never calls Pexels; this runs by hand and the admin serves the file itself.
 *
 * Usage: pnpm pexels:banner [--seed=<number>]   (a different seed picks a different photo)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { envLocal } from '../env-local.ts'

const key = envLocal('PEXELS_API_KEY')
if (!key) throw new Error('PEXELS_API_KEY is required (.env.local)')
const seedArg = process.argv.find((a) => a.startsWith('--seed='))
const seed = seedArg ? Number(seedArg.slice(7)) : Math.floor(Math.random() * 1000)
const queries = [
  'abstract gradient',
  'abstract texture',
  'abstract colorful shapes',
  'abstract light',
]
const query = queries[seed % queries.length] as string
const api = await fetch(
  `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=40&page=${1 + (seed % 3)}`,
  { headers: { authorization: key } },
)
if (!api.ok) throw new Error(`Pexels answered ${api.status}`)
const photos = (await api.json()).photos as {
  id: number
  alt: string
  photographer: string
  url: string
  src: { large2x: string }
  avg_color: string
}[]
if (!photos.length) throw new Error('no photo found')
const photo = photos[seed % photos.length] as (typeof photos)[number]
const image = Buffer.from(await (await fetch(photo.src.large2x)).arrayBuffer())
const out = join(import.meta.dirname, '../../apps/admin/public')
await mkdir(out, { recursive: true })
// Soft and wide: resized, a touch blurred so the cards on top stay legible, metadata stripped by the re-encode.
await sharp(image)
  .resize({ width: 1800, withoutEnlargement: true })
  .webp({ quality: 74 })
  .toFile(join(out, 'design-banner.webp'))
await writeFile(
  join(out, 'design-banner.json'),
  JSON.stringify(
    { photographer: photo.photographer, url: photo.url, id: photo.id, query },
    null,
    2,
  ),
)
console.log(
  `✓ ${query} — photo ${photo.id} by ${photo.photographer} → apps/admin/public/design-banner.webp`,
)
