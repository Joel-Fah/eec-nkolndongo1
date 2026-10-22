/**
 * Security gate: every mutating route is either permission-guarded or explicitly marked public with a reason.
 * Adding a POST/PUT/PATCH/DELETE without `requirePermission(...)`, `requireSelf()` or `publicRoute('why')`
 * fails this test.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'

describe('route table', () => {
  const app = createApp()
  const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  const byRoute = new Map<string, { guarded: boolean; reason?: string }>()
  for (const r of app.routes) {
    if (!mutating.has(r.method)) continue
    const key = `${r.method} ${r.path}`
    const h = r.handler as { __guard?: string; __public?: string }
    const cur = byRoute.get(key) ?? { guarded: false }
    if (h.__guard || h.__public) {
      cur.guarded = true
      cur.reason = h.__public ?? `permission: ${h.__guard}`
    }
    byRoute.set(key, cur)
  }

  it('has mutating routes to check', () => expect(byRoute.size).toBeGreaterThan(3))

  it('guards every mutating route', () => {
    const unguarded = [...byRoute].filter(([, v]) => !v.guarded).map(([k]) => k)
    expect(unguarded).toEqual([])
  })

  it('lists the public mutations (review this list on every change)', () => {
    const publics = [...byRoute]
      .filter(([, v]) => v.reason && !v.reason.startsWith('permission:'))
      .map(([k]) => k)
      .sort()
    expect(publics).toEqual([
      'POST /api/auth/*',
      'POST /api/contact/submit',
      'POST /api/invitations/:token/accept',
      'POST /api/members/google',
      'POST /api/members/signup',
      'POST /api/reset/:token',
    ])
  })
})
