import { describe, expect, it } from 'vitest'
import { headersFile, securityHeaders } from './security-headers.ts'

describe('securityHeaders', () => {
  it('always sets the baseline', () => {
    const h = securityHeaders({ https: false, noindex: false })
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['content-security-policy']).toContain("object-src 'none'")
    expect(h['referrer-policy']).toBeTruthy()
    expect(h['permissions-policy']).toContain('geolocation=()')
  })
  it('sends HSTS only over https, and noindex only before launch', () => {
    expect(
      securityHeaders({ https: false, noindex: false })['strict-transport-security'],
    ).toBeUndefined()
    expect(securityHeaders({ https: true, noindex: false })['strict-transport-security']).toContain(
      'max-age=',
    )
    expect(securityHeaders({ https: true, noindex: true })['x-robots-tag']).toContain('noindex')
    expect(securityHeaders({ https: true, noindex: false })['x-robots-tag']).toBeUndefined()
  })
  it('allows no third party script', () => {
    const csp = securityHeaders({ https: true, noindex: true })['content-security-policy'] ?? ''
    expect(/script-src[^;]*https?:/.test(csp)).toBe(false)
  })
  it('writes the same values into _headers', () => {
    const file = headersFile({ https: true, noindex: true })
    expect(file.startsWith('/*\n')).toBe(true)
    expect(file).toContain('x-robots-tag: noindex, nofollow')
  })
})
