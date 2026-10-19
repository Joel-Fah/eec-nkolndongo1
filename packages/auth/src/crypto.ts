/** WebCrypto helpers (Workers + Node). Tokens are random; only their SHA-256 is ever stored. */
const enc = new TextEncoder()

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/** 32 random bytes as base64url — 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Salted IP hash for the audit log: enough to correlate, impossible to read back. */
export async function ipHash(
  ip: string | null | undefined,
  secret: string,
): Promise<string | null> {
  if (!ip) return null
  return (await sha256(`${secret}|ip|${ip}`)).slice(0, 24)
}
