/**
 * Preview links: let an editor show an unpublished item to someone without an account. The link carries the
 * item, an expiry and an HMAC signature (keyed with AUTH_SECRET), so it cannot be guessed or extended, and it
 * stops working on its own. Pages opened through it are `noindex, no-store`.
 */
const enc = new TextEncoder()
const b64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
}

export async function signPreview(
  secret: string,
  entity: string,
  id: string,
  ttlSeconds = 60 * 60 * 24 * 3,
  now = Date.now(),
) {
  const payload = `${entity}.${id}.${Math.floor(now / 1000) + ttlSeconds}`
  return `${b64(enc.encode(payload))}.${await sign(secret, payload)}`
}

/** The item the link opens, or null if it is forged, expired or for another kind of item. */
export async function verifyPreview(
  secret: string,
  token: string,
  entity: string,
  now = Date.now(),
): Promise<string | null> {
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  let payload: string
  try {
    payload = atob(body.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
  const expected = await sign(secret, payload)
  if (expected.length !== mac.length) return null
  let diff = 0
  for (let i = 0; i < mac.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i)
  if (diff !== 0) return null
  const [kind, id, exp] = payload.split('.')
  if (kind !== entity || !id || Number(exp) * 1000 < now) return null
  return id
}
