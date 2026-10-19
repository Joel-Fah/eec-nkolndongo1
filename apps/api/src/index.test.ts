import { describe, expect, it } from 'vitest'
import { app } from './index.ts'

describe('GET /api/health', () => {
  it('answers ok without touching the database', async () => {
    const res = await app.request(
      '/api/health',
      {},
      { AUTH_SECRET: 'x', APP_ORIGIN: 'http://localhost:8080' },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
  it('rejects cross-origin mutations', async () => {
    const res = await app.request(
      '/api/auth/sign-in/email',
      { method: 'POST', headers: { origin: 'https://evil.example' } },
      { AUTH_SECRET: 'x', APP_ORIGIN: 'http://localhost:8080' },
    )
    expect(res.status).toBe(403)
  })
})
