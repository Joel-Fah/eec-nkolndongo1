import type { MessageKey } from '@eec/i18n'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

/** Same-origin JSON calls. Cookies are first-party (decision 0017): nothing to configure, no tokens in JS. */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError(0, 'network')
  }
  const text = await res.text()
  const json = text ? safeJson(text) : null
  if (!res.ok) throw new ApiError(res.status, normaliseCode(res.status, json))
  return json as T
}

const safeJson = (t: string) => {
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

/** Our API returns { error: { code } }; Better Auth returns { code, message }. */
function normaliseCode(status: number, body: unknown): string {
  const b = (body ?? {}) as { error?: { code?: string }; code?: string }
  if (status === 429) return 'rate_limited'
  if (b.error?.code) return b.error.code
  if (b.code) return b.code.toLowerCase()
  return status === 401 ? 'unauthenticated' : 'generic'
}

const KNOWN = new Set([
  'invalid_credentials',
  'rate_limited',
  'password_too_short',
  'password_too_long',
  'password_too_common',
  'invalid_link',
  'email_taken',
  'bad_origin',
  'network',
])

/** Map any error to a plain-French message key (never leaks technical detail). */
export function errorKey(e: unknown): MessageKey {
  const code = e instanceof ApiError ? e.code : 'generic'
  const mapped = code === 'invalid_email_or_password' ? 'invalid_credentials' : code
  return `auth.err.${KNOWN.has(mapped) ? mapped : 'generic'}` as MessageKey
}
