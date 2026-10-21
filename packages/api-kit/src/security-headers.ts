/**
 * Security headers for every response (Phase 02 §11): one definition, used by the Worker (dynamic
 * responses, `apps/web/src/worker.ts`) and by the build, which writes the same values into `_headers` for
 * static files (`apps/web/astro.config.mjs`). A test keeps both honest.
 *
 * CSP: inline scripts and styles are allowed because Astro and the theme bootstrap emit small inline ones;
 * everything else is `self`. Google profile pictures (member sign-in) and YouTube embeds (later) are the only
 * outside origins.
 */
export type HeaderOptions = {
  /** HSTS only over HTTPS (never on http://localhost). */
  https: boolean
  /** Not yet launched: ask search engines to stay away. */
  noindex: boolean
}

export function securityHeaders({ https, noindex }: HeaderOptions): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://images.pexels.com",
    "media-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://www.youtube-nocookie.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Worker for the photo processing (admin): same origin or blob.
    "worker-src 'self' blob:",
  ].join('; ')
  return {
    'content-security-policy': csp,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'cross-origin-opener-policy': 'same-origin',
    ...(https ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
    ...(noindex ? { 'x-robots-tag': 'noindex, nofollow' } : {}),
  }
}

/** The `_headers` file (Cloudflare Workers static assets) for the same values. */
export function headersFile(opts: HeaderOptions): string {
  const lines = Object.entries(securityHeaders(opts)).map(([k, v]) => `  ${k}: ${v}`)
  return `/*\n${lines.join('\n')}\n`
}
