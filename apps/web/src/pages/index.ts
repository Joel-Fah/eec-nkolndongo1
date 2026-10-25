import { openOnSunday } from '@eec/core'
import { pickLocale } from '@eec/i18n'
import type { APIRoute } from 'astro'
import { href, pages } from '../lib/nav'

// The only on-demand route: `/` sends visitors to /fr/ or /en/ based on their browser language. On a Sunday (parish time) the first
// visit of the day goes straight to « Ce dimanche », and a cookie lasting until the end of that day means every later visit opens
// the home as usual. It happens here, before any page is sent: no second preloader, no back-button trap. Direct visits to /fr/ or
// /en/ (bookmarks, the logo) are never redirected.
export const prerender = false

const COOKIE = 'eec-sun'
const seenToday = (cookie: string | null) =>
  cookie
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)

export const GET: APIRoute = ({ request }) => {
  const locale = pickLocale(request.headers.get('accept-language'))
  const now = new Date()
  const sunday = openOnSunday(now, seenToday(request.headers.get('cookie')))
  const headers = new Headers({
    Vary: 'Accept-Language, Cookie',
    'Cache-Control': 'private, max-age=0',
  })
  if (!sunday.open) {
    headers.set('Location', `/${locale}/`)
    return new Response(null, { status: 302, headers })
  }
  headers.set('Location', href(locale, pages.find((p) => p.id === 'dimanche')?.path[locale] ?? ''))
  // Until the end of the parish's Sunday (UTC+1, no daylight saving), at most a day.
  const endOfDay = Date.parse(`${sunday.today}T23:00:00Z`)
  const maxAge = Math.min(Math.max(Math.round((endOfDay - now.getTime()) / 1000), 60), 86_400)
  headers.append(
    'Set-Cookie',
    `${COOKIE}=${sunday.today}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`,
  )
  return new Response(null, { status: 302, headers })
}
