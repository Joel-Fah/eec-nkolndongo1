/**
 * « Mon espace » → the profile (decision 0047): the completion card, the member card with its gentle tilt, the consent and the optional
 * details, and the private photo (resized in the browser, so only a small WebP leaves the phone). Everything is the signed-in
 * person's own; the server decides what is stored. Texts come from the page (data-msgs).
 */
import { avatarSvg } from '@eec/ui/avatar-art'
import { initPickers } from '@eec/ui/pickers'
import { forgetBadge } from './account-badge'

type Details = {
  birthDate: string | null
  gender: string | null
  neighbourhood: string | null
  city: string | null
  maritalStatus: string | null
  profession: string | null
}
type Profile = {
  consent: boolean
  details: Details
  photo: {
    has: boolean
    source: 'upload' | 'google' | null
    googleAvailable: boolean
    url: string | null
    asAvatar: boolean
  }
  completeness: {
    steps: { key: string; done: boolean; optional: boolean }[]
    filled: number
    total: number
    complete: boolean
  }
  seed: number
  sacrament?: { baptised: boolean | null; confirmed: boolean | null }
}

async function api(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`/api${path}`, { credentials: 'same-origin', ...init })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, json }
  } catch {
    return { ok: false, json: {} }
  }
}
const put = (path: string, body: unknown, method = 'PUT') =>
  api(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const fill = (tpl: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((o, [k, v]) => o.replace(`{${k}}`, String(v)), tpl)

/** Resize and re-encode in the browser: a 512 px square-ish WebP (JPEG if WebP is not offered); metadata is dropped by the canvas. */
async function prepare(file: File): Promise<Blob | null> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  if (!bmp) return null
  const side = Math.min(bmp.width, bmp.height)
  const out = Math.min(512, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out)
  for (const [type, q] of [
    ['image/webp', 0.8],
    ['image/jpeg', 0.82],
  ] as const) {
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, type, q))
    if (blob && blob.type === type && blob.size <= 300 * 1024) return blob
  }
  return null
}

export function initProfile(root: HTMLElement, user: { firstName?: string; name?: string }) {
  const found = root.querySelector<HTMLElement>('[data-profile]')
  if (!found) return
  const host: HTMLElement = found
  const msgs = JSON.parse(host.dataset.msgs ?? '{}') as Record<string, string>
  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)
  const panel = q<HTMLDetailsElement>('[data-panel="fullprofile"]')
  const consentForm = q<HTMLFormElement>('[data-pf-consent]')
  const body = q<HTMLElement>('[data-pf-body]')
  const form = q<HTMLFormElement>('[data-pf-details]')
  const ok = q<HTMLElement>('[data-pf-ok]')
  let state: Profile | null = null

  const say = (text: string) => {
    if (!ok) return
    ok.textContent = text
    ok.hidden = false
    setTimeout(() => {
      ok.hidden = true
    }, 4000)
  }
  const avatar = (into: HTMLElement | null, p: Profile, size: number) => {
    if (!into) return
    into.innerHTML = p.photo.url
      ? `<img src="${p.photo.url}" alt="" width="${size}" height="${size}" decoding="async" referrerpolicy="no-referrer">`
      : avatarSvg(p.seed)
    // A picture that cannot load (a stale Google address, say) gives way to the generated avatar.
    into.querySelector('img')?.addEventListener('error', () => {
      into.innerHTML = avatarSvg(p.seed)
    })
  }
  const setSelect = (name: string, value: string | null) => {
    const native = form?.elements.namedItem(name) as HTMLSelectElement | null
    if (!native) return
    native.value = value ?? ''
    const opt = native.selectedOptions[0]
    const shown = native.closest('[data-select]')?.querySelector<HTMLElement>('[data-select-value]')
    if (shown) {
      shown.textContent = opt?.textContent ?? ''
      shown.toggleAttribute('data-placeholder', !value)
      shown.classList.toggle('text-ink-muted', !value)
    }
  }

  function paint(p: Profile) {
    state = p
    const c = p.completeness
    // Completion card
    const card = q<HTMLElement>('[data-profile-card]')
    if (card) {
      card.hidden = false
      card.dataset.state = c.complete ? 'done' : 'todo'
      const title = q('[data-pf-title]')
      if (title)
        title.textContent = c.complete
          ? (card.dataset.doneTitle ?? '')
          : (card.dataset.todoTitle ?? '')
      for (const li of card.querySelectorAll<HTMLElement>('[data-step]'))
        li.dataset.done = String(c.steps.find((s) => s.key === li.dataset.step)?.done ?? false)
      const bar = q<HTMLElement>('[data-pf-bar]')
      bar?.style.setProperty('--pf', `${Math.round((c.filled / c.total) * 100)}%`)
      bar?.setAttribute('aria-valuenow', String(c.filled))
      bar?.setAttribute('aria-valuemax', String(c.total))
      const prog = q('[data-pf-progress]')
      if (prog) prog.textContent = fill(msgs.progress ?? '', { n: c.filled, total: c.total })
      q<HTMLElement>('[data-pf-open]')?.toggleAttribute('hidden', c.complete)
      q<HTMLElement>('.pf-steps')?.toggleAttribute('hidden', c.complete)
      q<HTMLElement>('[data-pf-lead]')?.toggleAttribute('hidden', c.complete)
    }
    // Panel: consent or details; the photo is shown whenever there is one (Google's counts) or the consent allows adding one.
    if (consentForm) consentForm.hidden = p.consent
    if (body) body.hidden = !p.consent
    q<HTMLElement>('[data-pf-withdraw-zone]')?.toggleAttribute('hidden', !p.consent)
    q<HTMLElement>('[data-pf-photo]')?.toggleAttribute('hidden', !(p.consent || p.photo.has))
    q<HTMLElement>('[data-pf-choose]')?.toggleAttribute('hidden', !p.consent)
    if (p.consent && form) {
      const set = (n: string, v: string | null) => {
        const el = form.elements.namedItem(n) as HTMLInputElement | null
        if (el) {
          el.value = v ?? ''
          el.dispatchEvent(new Event('change'))
        }
      }
      set('birthDate', p.details.birthDate)
      set('neighbourhood', p.details.neighbourhood)
      set('city', p.details.city)
      set('profession', p.details.profession)
      setSelect('gender', p.details.gender)
      setSelect('maritalStatus', p.details.maritalStatus)
    }
    avatar(q('[data-pf-preview]'), p, 80)
    const remove = q<HTMLElement>('[data-pf-remove]')
    if (remove) {
      remove.toggleAttribute('hidden', !p.photo.has)
      remove.textContent =
        (p.photo.source === 'upload' && p.photo.googleAvailable
          ? remove.dataset.labelBack
          : remove.dataset.labelDelete) ?? ''
    }
    const src = q('[data-pf-source]')
    if (src)
      src.textContent =
        (p.photo.source === 'google'
          ? msgs.srcGoogle
          : p.photo.source === 'upload'
            ? msgs.srcUpload
            : msgs.srcNone) ?? ''
    q<HTMLElement>('[data-pf-avatar-zone]')?.toggleAttribute('hidden', !p.photo.has)
    const sw = q<HTMLInputElement>('#pf-avatar')
    if (sw) sw.checked = p.photo.asAvatar
    // Baptism and confirmation, as the member says them (the parish confirms from its own register).
    const sac = q<HTMLElement>('[data-pf-sacrament]')
    if (sac) {
      sac.hidden = !p.consent
      const b = q<HTMLInputElement>('#pf-baptised')
      const cf = q<HTMLInputElement>('#pf-confirmed')
      if (b) b.checked = p.sacrament?.baptised === true
      if (cf) cf.checked = p.sacrament?.confirmed === true
    }
  }

  async function load() {
    const r = await api('/me/profile')
    if (r.ok) paint(r.json as Profile)
  }

  // Header badge and card stay in step with what was just saved.
  const changed = async () => {
    forgetBadge()
    await load()
  }

  q('[data-pf-open]')?.addEventListener('click', () => {
    if (panel) {
      panel.open = true
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })

  consentForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const box = consentForm.querySelector<HTMLInputElement>('input[name="consent"]')
    const err = q('[data-pf-consent-error]')
    if (!box?.checked) {
      if (err) err.hidden = false
      return
    }
    if (err) err.hidden = true
    const r = await put('/me/profile/consent', { granted: true }, 'POST')
    if (r.ok) await changed()
  })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = new FormData(form)
    const v = (n: string) => String(f.get(n) ?? '').trim() || null
    const r = await put('/me/profile', {
      birthDate: v('birthDate'),
      gender: v('gender'),
      neighbourhood: v('neighbourhood'),
      city: v('city'),
      maritalStatus: v('maritalStatus'),
      profession: v('profession'),
    })
    if (r.ok) {
      say(msgs.saved ?? '')
      await changed()
    } else say(msgs.error ?? '')
  })

  q('[data-pf-withdraw]')?.addEventListener('click', async () => {
    const r = await put('/me/profile/consent', { granted: false }, 'POST')
    if (r.ok) {
      await changed()
      say(msgs.withdrawn ?? '')
    }
  })

  const file = q<HTMLInputElement>('[data-pf-file]')
  q('[data-pf-choose]')?.addEventListener('click', () => file?.click())
  file?.addEventListener('change', async () => {
    const f = file.files?.[0]
    file.value = ''
    if (!f) return
    const blob = await prepare(f)
    if (!blob) return say(msgs.photoErr ?? '')
    const data = new FormData()
    data.append('file', blob, blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg')
    const r = await api('/me/photo', { method: 'PUT', body: data })
    if (r.ok) {
      say(msgs.photoSaved ?? '')
      await changed()
    } else say(msgs.photoErr ?? '')
  })
  q('[data-pf-remove]')?.addEventListener('click', async () => {
    const r = await api('/me/photo', { method: 'DELETE' })
    if (r.ok) await changed()
  })
  q<HTMLInputElement>('#pf-avatar')?.addEventListener('change', async (e) => {
    const r = await put('/me/photo-avatar', { use: (e.target as HTMLInputElement).checked })
    if (r.ok) {
      say(msgs.levelSaved ?? '')
      await changed()
    }
  })

  // Declaring a baptism or confirmation is a statement about belief: the person reads what it means and agrees before it is saved.
  const dialog = host.querySelector<HTMLDialogElement>('[data-pf-sac-dialog]')
  const ack = dialog?.querySelector<HTMLInputElement>('#pf-sac-ack')
  const go = dialog?.querySelector<HTMLButtonElement>('[data-pf-sac-go]')
  let pending: HTMLInputElement | null = null
  const saveSacrament = async (acknowledged: boolean) => {
    const r = await put('/communion/me/sacrament', {
      baptised: q<HTMLInputElement>('#pf-baptised')?.checked ? true : null,
      confirmed: q<HTMLInputElement>('#pf-confirmed')?.checked ? true : null,
      ack: acknowledged,
    })
    if (r.ok) say(msgs.levelSaved ?? '')
    else void load()
  }
  for (const id of ['#pf-baptised', '#pf-confirmed']) {
    const box = q<HTMLInputElement>(id)
    box?.addEventListener('change', () => {
      if (!box.checked) return void saveSacrament(false)
      // switched on: put it back until the person has read and agreed
      box.checked = false
      pending = box
      if (ack) ack.checked = false
      if (go) go.disabled = true
      dialog?.showModal()
    })
  }
  ack?.addEventListener('change', () => {
    if (go) go.disabled = !ack.checked
  })
  host.querySelector('[data-pf-sac-cancel]')?.addEventListener('click', () => {
    pending = null
    dialog?.close()
  })
  host.querySelector('[data-pf-sac-form]')?.addEventListener('submit', () => {
    if (!pending || !ack?.checked) return
    pending.checked = true
    pending = null
    void saveSacrament(true)
  })

  initPickers(host)
  void load()
}
