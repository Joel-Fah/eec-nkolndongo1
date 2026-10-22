/**
 * The contact form: sends JSON to /api/contact/submit. Anti-spam without a third party — a hidden honeypot, the time
 * the form was shown (a minimum fill time is checked by the API), and a rate limit there. Consent is a tick the visitor
 * makes (never pre-ticked). Text is set with textContent only.
 */
const MESSAGES: Record<string, string> = {
  too_fast: 'err_fast',
  rate_limited: 'err_rate',
}

export function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]')
  if (!form || form.dataset.ready) return
  form.dataset.ready = '1'
  const openedAt = Date.now()
  const status = form.querySelector<HTMLElement>('[data-status]')
  const done = document.querySelector<HTMLElement>('[data-contact-done]')
  const say = (key: string) => {
    if (status) status.textContent = form.dataset[key] ?? ''
  }
  form.removeAttribute('data-nojs')
  const category = form.querySelector<HTMLSelectElement>('select[name="category"]')
  const prayer = form.querySelector<HTMLElement>('[data-prayer-help]')
  const syncPrayer = () => {
    if (prayer) prayer.hidden = category?.value !== 'priere'
  }
  category?.addEventListener('change', syncPrayer)
  syncPrayer()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = new FormData(form)
    const val = (k: string) => String(data.get(k) ?? '').trim()
    if (!val('email') && !val('phone')) return say('errReach')
    if (!data.get('consent')) return say('errConsent')
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (button) button.disabled = true
    say('sending')
    try {
      const res = await fetch('/api/contact/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          name: val('name'),
          email: val('email'),
          phone: val('phone'),
          category: val('category'),
          subject: val('subject'),
          message: val('message'),
          consent: true,
          website: val('website'),
          openedAt,
        }),
      })
      if (res.ok) {
        form.hidden = true
        if (done) {
          done.hidden = false
          done.querySelector<HTMLElement>('h3')?.focus()
        }
        return
      }
      const code =
        ((await res.json().catch(() => ({}))) as { error?: { code?: string } }).error?.code ?? ''
      const key = MESSAGES[code]
      say(key === 'err_fast' ? 'errFast' : key === 'err_rate' ? 'errRate' : 'err')
    } catch {
      say('err')
    } finally {
      if (button) button.disabled = false
    }
  })
  done?.querySelector('[data-again]')?.addEventListener('click', () => {
    form.reset()
    form.hidden = false
    if (done) done.hidden = true
    say('')
  })
}
