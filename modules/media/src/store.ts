/**
 * The object store behind the library: any S3-compatible service (Neon Object Storage today, R2 later —
 * a change of four variables and a copy, decision 0020). Requests are signed with aws4fetch (about 1 KB, no
 * AWS SDK in the Worker). Neon speaks path-style only: <endpoint>/<bucket>/<key>. No bucket is ever public;
 * files leave through /media/<key> (serve.ts).
 */
import type { Env } from '@eec/api-kit'
import { AwsClient } from 'aws4fetch'

export type Store = ReturnType<typeof createStore>

export function createStore(env: Env) {
  const endpoint = env.AWS_ENDPOINT_URL_S3
  if (!endpoint || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY)
    throw new Error(
      'Object storage is not configured (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)',
    )
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
    async put(key: string, body: ArrayBuffer | ReadableStream, mime: string, length?: number) {
      const headers: Record<string, string> = { 'content-type': mime }
      // Streams are not hashed (the request is over TLS): the payload hash is declared unsigned.
      if (body instanceof ReadableStream) {
        headers['x-amz-content-sha256'] = 'UNSIGNED-PAYLOAD'
        if (length !== undefined) headers['content-length'] = String(length)
      }
      const res = await aws.fetch(url(key), { method: 'PUT', headers, body })
      if (!res.ok) throw new Error(`storage put ${res.status}`)
    },
    /** A GET (optionally ranged); the caller streams the response. */
    get(key: string, headers: Record<string, string> = {}) {
      return aws.fetch(url(key), { headers })
    },
    async delete(key: string) {
      const res = await aws.fetch(url(key), { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`storage delete ${res.status}`)
    },
  }
}
