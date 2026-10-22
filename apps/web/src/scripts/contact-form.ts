/**
 * The contact form as a conversation, four short steps: the need (tiles), the message (with starting phrases), how to
 * reply (WhatsApp/phone or e-mail), a last look and the consent. Sends JSON to /api/contact/submit. Anti-spam without a
 * third party: a hidden honeypot and the time the form was shown (a minimum fill time is checked by the API), plus a rate
 * limit there. Consent is a tick the visitor makes (never pre-ticked). Text is set with textContent only.
 */
type Strings = Record<string, string>
const STEPS = 4
const MESSAGES: Record<string, string> = { too_fast: 'errFast', rate_limited: 'errRate' }

export function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]')
  if (!form || form.dataset.ready) return
  form.dataset.ready = '1'
  const openedAt = Date.now()
  const L = JSON.parse(form.dataset.i18n ?? '{}') as Strings
  const status = form.querySelector<HTMLElement>('[data-status]')
  const done = document.querySelector<HTMLElement>('[data-contact-done]')
  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')]
  const back = form.querySelector<HTMLElement>('[data-back]')
  const next = form.querySelector<HTMLElement>('[data-next]')
  const send = form.querySelector<HTMLButtonElement>('[data-send]')
  const fill = form.querySelector<HTMLElement>('[data-fill]')
  const label = form.querySelector<HTMLElement>('[data-step-label]')
  const message = form.querySelector<HTMLTextAreaElement>('textarea[name="message"]')
  const count = form.querySelector<HTMLElement>('[data-count]')
  const prayer = form.querySelector<HTMLElement>('[data-prayer-help]')
  const field = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`)
  const val = (n: string) => (field(n)?.value ?? '').trim()
  const checked = (n: string) =>
    form.querySelector<HTMLInputElement>(`input[name="${n}"]:checked`)?.value ?? ''
  const say = (text: string) => {
    if (status) status.textContent = text
  }
  form.removeAttribute('data-nojs')
  let at = 0

  const reachFields = () => {
    const mode = checked('reach') || 'phone'
    for (const el of form.querySelectorAll<HTMLElement>('[data-reach-field]'))
      el.hidden = el.dataset.reachField !== mode
  }
  const show = (n: number, focus = true) => {
    at = Math.max(0, Math.min(STEPS - 1, n))
    steps.forEach((s, i) => {
      s.hidden = i !== at
    })
    if (fill) fill.style.width = `${((at + 1) / STEPS) * 100}%`
    if (label)
      label.textContent = (L.step ?? '')
        .replace('{n}', String(at + 1))
        .replace('{total}', String(STEPS))
    if (back) back.hidden = at === 0
    if (next) next.hidden = at === STEPS - 1
    if (send) send.hidden = at !== STEPS - 1
    if (prayer) prayer.hidden = checked('category') !== 'priere'
    if (at === 3) summary()
    say('')
    if (focus) steps[at]?.querySelector<HTMLElement>('.cf-q')?.focus()
  }
  const summary = () => {
    const cat = form
      .querySelector<HTMLInputElement>('input[name="category"]:checked')
      ?.closest('label')
      ?.querySelector('strong')?.textContent
    const set = (k: string, v: string) => {
      const el = form.querySelector<HTMLElement>(`[data-sum="${k}"]`)
      if (el) el.textContent = v
    }
    set('category', cat ?? '')
    const m = val('message')
    set('message', m.length > 140 ? `${m.slice(0, 140)}…` : m)
    set('reach', checked('reach') === 'email' ? val('email') : val('phone'))
  }
  const problem = (): string => {
    if (at === 0 && !checked('category')) return L.errCategory ?? ''
    if (at === 1 && val('message').length < 10) return L.errMessage ?? ''
    if (at === 2) {
      if (val('name').length < 2) return L.errName ?? ''
      const mode = checked('reach') || 'phone'
      if (!val(mode)) return L.errReach ?? ''
    }
    return ''
  }
  const go = () => {
    const p = problem()
    if (p) return say(p)
    show(at + 1)
  }

  next?.addEventListener('click', go)
  back?.addEventListener('click', () => show(at - 1))
  // Choosing a need moves straight on: one tap.
  for (const r of form.querySelectorAll<HTMLInputElement>('input[name="category"]'))
    r.addEventListener('change', () => window.setTimeout(() => at === 0 && show(1), 220))
  for (const r of form.querySelectorAll<HTMLInputElement>('input[name="reach"]'))
    r.addEventListener('change', reachFields)
  for (const b of form.querySelectorAll<HTMLButtonElement>('[data-starter]'))
    b.addEventListener('click', () => {
      if (!message) return
      message.value = message.value
        ? `${message.value} ${b.dataset.starter ?? ''}`
        : (b.dataset.starter ?? '')
      message.focus()
      message.dispatchEvent(new Event('input'))
    })
  message?.addEventListener('input', () => {
    if (count) count.textContent = (L.count ?? '').replace('{n}', String(message.value.length))
  })
  // Enter moves on from a one-line field instead of submitting early.
  form.addEventListener('keydown', (e) => {
    if (
      e.key === 'Enter' &&
      (e.target as HTMLElement).tagName === 'INPUT' &&
      (e.target as HTMLInputElement).type !== 'checkbox' &&
      at < STEPS - 1
    ) {
      e.preventDefault()
      go()
    }
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (at !== STEPS - 1) return go()
    if (!field('consent')?.checked) return say(L.errConsent ?? '')
    const mode = checked('reach') || 'phone'
    if (send) send.disabled = true
    say(L.sending ?? '')
    try {
      const res = await fetch('/api/contact/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          name: val('name'),
          email: mode === 'email' ? val('email') : '',
          phone: mode === 'phone' ? val('phone') : '',
          category: checked('category'),
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
      say(L[MESSAGES[code] ?? 'err'] ?? '')
    } catch {
      say(L.err ?? '')
    } finally {
      if (send) send.disabled = false
    }
  })
  done?.querySelector('[data-again]')?.addEventListener('click', () => {
    form.reset()
    form.hidden = false
    if (done) done.hidden = true
    reachFields()
    show(0, false)
  })
  reachFields()
  // A need chosen through the link (e.g. from a guide) starts on the message.
  show(checked('category') ? 1 : 0, false)
}
