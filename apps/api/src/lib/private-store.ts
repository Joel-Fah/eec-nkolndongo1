/**
 * Private objects (decision 0047): the same S3-compatible bucket as the media library, under a key prefix that is NOT a public media
 * key (`private/…`), so `/media/<key>` can never serve it. Only routes that check the session read it, and answer `private, no-store`.
 */
import type { Env } from '@eec/api-kit'
import { AwsClient } from 'aws4fetch'

export function createPrivateStore(env: Env) {
  const endpoint = env.AWS_ENDPOINT_URL_S3
  if (!endpoint || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY)
    throw new Error('Object storage is not configured')
  const bucket = env.MEDIA_BUCKET ?? 'eec-media'
  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION ?? 'auto',
    service: 's3',
  })
  const url = (key: string) =>
    `${endpoint.replace(/\/$/, '')}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
  return {
    async put(key: string, body: ArrayBuffer, mime: string) {
      const res = await aws.fetch(url(key), {
        method: 'PUT',
        headers: { 'content-type': mime },
        body,
      })
      if (!res.ok) throw new Error(`storage put ${res.status}`)
    },
    get: (key: string) => aws.fetch(url(key)),
    async delete(key: string) {
      const res = await aws.fetch(url(key), { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`storage delete ${res.status}`)
    },
  }
}

export const PHOTO_MAX_BYTES = 300 * 1024
/** WebP or JPEG, by their first bytes (never by the name or the declared type). */
export function sniffPhoto(b: Uint8Array): { mime: string; ext: string } | null {
  if (
    b.length > 12 &&
    String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...b.slice(8, 12)) === 'WEBP'
  )
    return { mime: 'image/webp', ext: 'webp' }
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { mime: 'image/jpeg', ext: 'jpg' }
  return null
}
