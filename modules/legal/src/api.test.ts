import { describe, expect, it } from 'vitest'
import { draftBody, publishBody } from './api.ts'

describe('legal input', () => {
  it('a draft only carries the two texts (state and version are not client-writable)', () => {
    expect(draftBody.safeParse({ bodyFr: { type: 'doc', content: [] } }).success).toBe(true)
    expect(draftBody.safeParse({ state: 'published' }).success).toBe(false)
    expect(draftBody.safeParse({ version: 9 }).success).toBe(false)
  })
  it('publishing carries a summary and the purpose-change flag, nothing else', () => {
    expect(publishBody.safeParse({ summaryFr: 'Ajout…', purposeChanged: true }).success).toBe(true)
    expect(publishBody.safeParse({ label: 'x' }).success).toBe(false)
    expect(publishBody.safeParse({ summaryFr: 'x'.repeat(601) }).success).toBe(false)
  })
})
