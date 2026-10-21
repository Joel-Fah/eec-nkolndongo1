/**
 * Imports approved Pexels photos (no people) into the MEDIA LIBRARY of the database/bucket the environment points at
 * (dev with .env.local; production through the PROD shell). Decision 0009: the live site never calls Pexels, files are
 * self-hosted. For each id: download the large original (cached), strip metadata, write WebP variants 480/960/1600,
 * compute a ThumbHash, upload to the media bucket, insert `media_files` with `source='pexels'`, the photographer's
 * credit and a placeholder description marked [À VALIDER] (to be corrected by a person). Idempotent: ids already
 * imported are skipped. Needs scripts/.cache/pexels/last.json (the last search) and `selection.json`.
 *
 * Usage: node pexels/import-library.ts <selection.json> [--dry-run]
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AwsClient } from 'aws4fetch'
import pg from 'pg'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import { envLocal } from '../env-local.ts'

const need = (n: string) => {
  const v = envLocal(n)
  if (!v) throw new Error(`${n} is required`)
  return v
}
const dry = process.argv.includes('--dry-run')
const selectionFile = process.argv[2]
if (!selectionFile) throw new Error('Usage: import-library.ts <selection.json> [--dry-run]')
const cache = join(import.meta.dirname, '../.cache/pexels')
const candidates = new Map<
  number,
  {
    id: number
    alt: string
    photographer: string
    photographer_url: string
    url: string
    src: { large2x: string }
  }
>(
  (
    JSON.parse(await readFile(join(cache, 'last.json'), 'utf8')) as {
      id: number
      alt: string
      photographer: string
      photographer_url: string
      url: string
      src: { large2x: string }
    }[]
  ).map((p) => [p.id, p]),
)
const keep = (
  (JSON.parse(await readFile(selectionFile, 'utf8')) as { keep: string[] }).keep ?? []
).map(Number)

// French placeholder descriptions by kind of photo (a person must read and correct them: [À VALIDER]).
const THEMES: [number[], string, string][] = [
  [
    [33120492, 13718039, 7219504, 35697216, 29281308, 544252],
    'Intérieur d’une église, bancs de bois',
    'Church interior with wooden pews',
  ],
  [
    [15382617, 26586336, 8268309, 22710957, 3633711, 10217584, 208195],
    'Bible ou recueil de chants ouvert',
    'An open Bible or hymn book',
  ],
  [
    [
      32492673, 8057427, 7079874, 40387748, 38414436, 15947129, 31371429, 33464393, 35057004,
      33408795, 31550736, 9783072, 18319865, 4337668, 32695455, 13892575, 33263927,
    ],
    'Paysage de collines et lumière du jour',
    'Landscape of hills in daylight',
  ],
  [
    [
      16243826, 6927631, 15222236, 1683916, 5864750, 1047444, 38921291, 18005301, 15689799,
      12529226, 33894647, 12236025, 614006, 12199572, 36325874, 34454659, 35308790, 36836675,
      7292901, 37297540,
    ],
    'Fruits, maïs ou bananes de la récolte',
    'Fruit, maize or bananas from the harvest',
  ],
  [
    [18290579, 10996743, 53959, 18290581],
    'Croix en silhouette dans la lumière du soleil',
    'A plain cross in silhouette against the sun',
  ],
  [
    [131639, 172295, 7794365, 7533979, 7232397, 7533977, 6275942],
    'Texture de bois ou de tissu',
    'Wood or fabric texture',
  ],
]
const themeOf = (id: number) => THEMES.find(([ids]) => ids.includes(id))

const db = new pg.Client({
  connectionString: need('DATABASE_URL_UNPOOLED'),
  connectionTimeoutMillis: 30000,
})
await db.connect()
const aws = new AwsClient({
  accessKeyId: need('AWS_ACCESS_KEY_ID'),
  secretAccessKey: need('AWS_SECRET_ACCESS_KEY'),
  region: envLocal('AWS_REGION') ?? 'auto',
  service: 's3',
})
const bucketBase = `${need('AWS_ENDPOINT_URL_S3').replace(/\/$/, '')}/${envLocal('MEDIA_BUCKET') ?? 'eec-media'}`
console.log(
  `target: branch ${envLocal('NEON_BRANCH')}, database ${new URL(need('DATABASE_URL_UNPOOLED')).host}, ${keep.length} photos${dry ? ' (dry run)' : ''}`,
)

await mkdir(join(cache, 'originals'), { recursive: true })
const have = new Set(
  (await db.query("select source_id from media_files where source='pexels'")).rows.map(
    (r) => r.source_id as string,
  ),
)
let done = 0
let skipped = 0
let bytes = 0
for (const id of keep) {
  const p = candidates.get(id)
  const theme = themeOf(id)
  if (!p || !theme) {
    console.log(`skip ${id}: not in the last search or no theme`)
    continue
  }
  if (have.has(String(id))) {
    skipped++
    continue
  }
  if (dry) {
    done++
    continue
  }
  const file = join(cache, 'originals', `${id}.jpg`)
  if (!existsSync(file)) {
    const res = await fetch(p.src.large2x, { headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`download ${id}: ${res.status}`)
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
  }
  const original = sharp(await readFile(file)).rotate() // upright; sharp drops metadata on output
  const meta = await original.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const uuid = crypto.randomUUID()
  const now = new Date()
  const base = `image/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${uuid}`
  const variants: { key: string; width: number; size: number; mime: string }[] = []
  for (const w of [...new Set([480, 960, 1600].map((x) => Math.min(x, width)))].sort(
    (a, b) => a - b,
  )) {
    const buf = await original.clone().resize({ width: w }).webp({ quality: 80 }).toBuffer()
    const key = `${base}/w${w}.webp`
    const res = await aws.fetch(`${bucketBase}/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/webp' },
      body: buf,
    })
    if (!res.ok) throw new Error(`upload ${key}: ${res.status}`)
    variants.push({ key, width: w, size: buf.length, mime: 'image/webp' })
  }
  const small = await original
    .clone()
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const placeholder = Buffer.from(
    rgbaToThumbHash(small.info.width, small.info.height, small.data),
  ).toString('base64')
  const size = variants.reduce((n, v) => n + v.size, 0)
  await db.query(
    `insert into media_files (id, kind, mime, original_name, size_bytes, width, height, variants, placeholder, alt_fr, alt_en, credit, credit_url, source, source_id, status)
     values ($1,'image','image/webp',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pexels',$12,'ready')`,
    [
      uuid,
      `pexels-${id}.webp`,
      size,
      width,
      height,
      JSON.stringify(variants),
      placeholder,
      `[À VALIDER] ${theme[1]}`,
      `[À VALIDER] ${theme[2]}`,
      p.photographer,
      p.photographer_url,
      String(id),
    ],
  )
  done++
  bytes += size
  if (done % 10 === 0) console.log(`… ${done} imported`)
}
console.log(
  `pexels import: ${done} ${dry ? 'would be ' : ''}imported (${(bytes / 1024 / 1024).toFixed(1)} MB), ${skipped} already there`,
)
await db.end()
