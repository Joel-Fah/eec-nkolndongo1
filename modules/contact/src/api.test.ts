import { describe, expect, it } from 'vitest'
import { noteBody, patchBody, submitBody } from './api.ts'

const ok = {
  name: 'Marie',
  email: 'marie@example.com',
  category: 'renseignement',
  message: 'Bonjour, une question.',
  consent: true,
  openedAt: 1,
  website: '',
}

describe('contact input', () => {
  it('accepts a complete, consented message', () =>
    expect(submitBody.safeParse(ok).success).toBe(true))
  it('needs consent, ticked explicitly (never assumed)', () => {
    expect(submitBody.safeParse({ ...ok, consent: false }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, consent: undefined }).success).toBe(false)
  })
  it('needs an email or a phone', () => {
    expect(submitBody.safeParse({ ...ok, email: '', phone: '' }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, email: '', phone: '+237 6 00 00 00 00' }).success).toBe(
      true,
    )
  })
  it('bounds the lengths and refuses unknown categories and fields', () => {
    expect(submitBody.safeParse({ ...ok, message: 'x'.repeat(2001) }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, message: 'court' }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, category: 'spam' }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, sensitive: false }).success).toBe(false) // sensitivity is decided by the server
  })
  it('staff changes: only known statuses', () => {
    expect(patchBody.safeParse({ status: 'handled' }).success).toBe(true)
    expect(patchBody.safeParse({ status: 'deleted' }).success).toBe(false)
    expect(noteBody.safeParse({ body: '' }).success).toBe(false)
  })
})
