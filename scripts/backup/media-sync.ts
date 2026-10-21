/**
 * `pnpm media:sync` — a second copy of the media library in another S3-compatible store (Cloudflare R2).
 * Files are immutable (a key is never rewritten), so the job only copies keys the copy does not have yet; it never
 * deletes. Source: the media bucket (AWS_* / MEDIA_BUCKET). Copy: MEDIA_COPY_ENDPOINT, MEDIA_COPY_ACCESS_KEY_ID,
 * MEDIA_COPY_SECRET_ACCESS_KEY, MEDIA_COPY_BUCKET (R2: https://<account id>.r2.cloudflarestorage.com, region auto).
 * Prints counts, never keys' contents or secrets. Meant for the weekly backup workflow and for by-hand runs.
 */
import { AwsClient } from 'aws4fetch'
import { envLocal } from '../env-local.ts'

const need = (name: string) => {
  const v = envLocal(name)
  if (!v) throw new Error(`${name} is required`)
  return v
}
const srcBase = `${need('AWS_ENDPOINT_URL_S3').replace(/\/$/, '')}/${envLocal('MEDIA_BUCKET') ?? 'eec-media'}`
const dstBase = `${need('MEDIA_COPY_ENDPOINT').replace(/\/$/, '')}/${need('MEDIA_COPY_BUCKET')}`
const src = new AwsClient({
  accessKeyId: need('AWS_ACCESS_KEY_ID'),
  secretAccessKey: need('AWS_SECRET_ACCESS_KEY'),
  region: envLocal('AWS_REGION') ?? 'auto',
  service: 's3',
})
const dst = new AwsClient({
  accessKeyId: need('MEDIA_COPY_ACCESS_KEY_ID'),
  secretAccessKey: need('MEDIA_COPY_SECRET_ACCESS_KEY'),
  region: 'auto',
  service: 's3',
})

async function keys(client: AwsClient, base: string): Promise<Map<string, number>> {
  const found = new Map<string, number>()
  let token: string | undefined
  do {
    const url = `${base}?list-type=2${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`
    const res = await client.fetch(url)
    if (!res.ok) throw new Error(`list failed: ${res.status}`)
    const xml = await res.text()
    for (const m of xml.matchAll(
      /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g,
    ))
      found.set(m[1] as string, Number(m[2]))
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1]
      : undefined
  } while (token)
  return found
}

const have = await keys(dst, dstBase)
const all = await keys(src, srcBase)
let copied = 0
let bytes = 0
let skipped = 0
for (const [key, size] of all) {
  if (have.get(key) === size) {
    skipped++
    continue
  }
  const path = key.split('/').map(encodeURIComponent).join('/')
  const get = await src.fetch(`${srcBase}/${path}`)
  if (!get.ok || !get.body) throw new Error(`read failed (${get.status}): ${key}`)
  const put = await dst.fetch(`${dstBase}/${path}`, {
    method: 'PUT',
    headers: { 'content-type': get.headers.get('content-type') ?? 'application/octet-stream' },
    body: await get.arrayBuffer(),
  })
  if (!put.ok) throw new Error(`write failed (${put.status}): ${key}`)
  copied++
  bytes += size
}
console.log(
  `media copy: ${all.size} in the library, ${copied} copied (${(bytes / 1024).toFixed(0)} KB), ${skipped} already there`,
)
