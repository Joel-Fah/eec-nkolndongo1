/**
 * Profile completion for the signed-in person, inside « Mon compte » (decision 0047): the optional details behind their own consent, a
 * photo that the parish team sees and that is never public, and the choice of showing it or a generated avatar in the menu. Same API as
 * « Mon espace » on the public site; the team are members of the congregation too.
 */
import { api, DateField, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { avatarSvg } from '@eec/ui/avatar-art'
import { Button, CheckboxField, Icon, SelectField, SwitchField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { notify } from './kit'

type Details = {
  birthDate: string | null
  gender: string | null
  neighbourhood: string | null
  city: string | null
  maritalStatus: string | null
  profession: string | null
}
export type MyProfile = {
  consent: boolean
  details: Details
  signIn: ('google' | 'email')[]
  /** Whether Google is set up on this site at all. */
  googleEnabled: boolean
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
}

/** The admin loads only its own words: these are the same sentences as `member.profile.*` on the public site. */
const p = (key: string) => `admin.profile.${key}` as MessageKey

/** Resize and re-encode in the browser: at most 512 px, WebP (JPEG if WebP is not offered), under 300 KB; metadata is dropped. */
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

export function useMyProfile() {
  return useQuery({ queryKey: ['my-profile'], queryFn: () => api<MyProfile>('/me/profile') })
}

export function ProfilePanel() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const q = useMyProfile()
  const d = q.data
  const [agree, setAgree] = useState(false)
  const [form, setForm] = useState<Details | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-profile'] })
    qc.invalidateQueries({ queryKey: ['badge'] })
    try {
      sessionStorage.removeItem('eec-badge')
    } catch {
      // storage blocked
    }
  }
  // The form starts from what is saved, once.
  if (d && form === null) setForm(d.details)
  const fail = () => notify(t('admin.common.error'), { tone: 'danger' })

  const consent = useMutation({
    mutationFn: (granted: boolean) =>
      api('/me/profile/consent', { method: 'POST', body: { granted } }),
    onSuccess: (_r, granted) => {
      if (!granted) setForm(null)
      setAgree(false)
      refresh()
      notify(t(granted ? 'admin.common.saved' : p('withdrawn')))
    },
    onError: fail,
  })
  const save = useMutation({
    mutationFn: () => api('/me/profile', { method: 'PUT', body: form }),
    onSuccess: () => {
      refresh()
      notify(t(p('msg_saved')))
    },
    onError: fail,
  })
  const upload = useMutation({
    mutationFn: async (f: File) => {
      const blob = await prepare(f)
      if (!blob) throw new Error('photo')
      const data = new FormData()
      data.append('file', blob, blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg')
      const res = await fetch('/api/me/photo', {
        method: 'PUT',
        credentials: 'include',
        body: data,
      })
      if (!res.ok) throw new Error('photo')
    },
    onSuccess: () => {
      refresh()
      notify(t(p('photo_saved')))
    },
    onError: () => notify(t(p('photo_err')), { tone: 'danger' }),
  })
  const remove = useMutation({
    mutationFn: () => api('/me/photo', { method: 'DELETE' }),
    onSuccess: refresh,
    onError: fail,
  })
  const asAvatar = useMutation({
    mutationFn: (use: boolean) => api('/me/photo-avatar', { method: 'PUT', body: { use } }),
    onSuccess: () => {
      refresh()
      notify(t(p('avatar_saved')))
    },
    onError: fail,
  })
  if (!d) return <section className="admin-panel" aria-busy="true" />

  const set = (key: keyof Details, v: string) =>
    setForm((f) => ({ ...(f as Details), [key]: v || null }))
  const text = (key: keyof Details, label: string, ph: string) => (
    <TextField
      label={label}
      placeholder={ph}
      maxLength={80}
      value={form?.[key] ?? ''}
      onChange={(e: { target: { value: string } }) => set(key, e.target.value)}
    />
  )
  const c = d.completeness
  const pct = Math.round((c.filled / c.total) * 100)

  return (
    <section className="admin-panel" aria-labelledby="pp-title">
      <div className="pp-head">
        <span className="pp-ico" aria-hidden="true">
          <Icon name="userRoundPlus" size={20} />
        </span>
        <div className="grid gap-1">
          <h2 id="pp-title" className="text-xl">
            {t(p(c.complete ? 'done_t' : 'title'))}
          </h2>
          <p className="text-sm text-ink-muted">{t(p(c.complete ? 'done_p' : 'lead'))}</p>
        </div>
      </div>
      <div
        className="pp-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={c.total}
        aria-valuenow={c.filled}
        style={{ ['--pp' as string]: `${pct}%` }}
      >
        <span />
      </div>
      <ol className="pp-steps">
        {c.steps.map((s) => (
          <li key={s.key} data-done={s.done}>
            <span className="pp-tick" aria-hidden="true" />
            {t(p(`step_${s.key}`))}
            {s.optional && <span className="text-ink-muted"> · {t(p('optional'))}</span>}
          </li>
        ))}
      </ol>

      {!d.consent ? (
        <div className="pp-block">
          <h3 className="text-lg">{t(p('consent_t'))}</h3>
          <ul className="pp-why">
            {['why_birth', 'why_gender', 'why_place', 'why_life'].map((k) => (
              <li key={k}>{t(p(k))}</li>
            ))}
          </ul>
          <CheckboxField
            label={t(p('consent_label'))}
            checked={agree}
            onCheckedChange={(v: boolean) => setAgree(v)}
          />
          <p className="text-sm text-ink-muted">{t(p('consent_help'))}</p>
          <div>
            <Button
              disabled={!agree}
              loading={consent.isPending}
              onClick={() => consent.mutate(true)}
            >
              {t(p('consent_go'))}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="pp-block">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                label={t(p('birth'))}
                value={form?.birthDate ?? ''}
                onChange={(v: string) => set('birthDate', v)}
                max={new Date().toISOString().slice(0, 10)}
              />
              <SelectField
                label={t(p('gender'))}
                placeholder={t(p('ph_select'))}
                value={form?.gender ?? undefined}
                onValueChange={(v) => set('gender', v ?? '')}
                options={['woman', 'man'].map((g) => ({ value: g, label: t(p(`gender_${g}`)) }))}
              />
              {text('neighbourhood', t(p('neighbourhood')), t(p('ph_neighbourhood')))}
              {text('city', t(p('city')), t(p('ph_city')))}
              <SelectField
                label={t(p('marital'))}
                placeholder={t(p('ph_select'))}
                value={form?.maritalStatus ?? undefined}
                onValueChange={(v) => set('maritalStatus', v ?? '')}
                options={['single', 'married', 'widowed', 'divorced'].map((m) => ({
                  value: m,
                  label: t(p(`marital_${m}`)),
                }))}
              />
              {text('profession', t(p('profession')), t(p('ph_profession')))}
            </div>
            <div>
              <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
                {t(p('btn_save'))}
              </Button>
            </div>
          </div>

          <div className="pp-block">
            <h3 className="text-lg">{t(p('photo_t'))}</h3>
            <p className="text-sm text-ink-muted">{t(p('photo_p'))}</p>
            <div className="pp-photo-row">
              <span className="pp-photo" aria-hidden="true">
                {d.photo.url ? (
                  <img src={d.photo.url} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: our own drawing, built from a number
                    dangerouslySetInnerHTML={{ __html: avatarSvg(d.seed) }}
                  />
                )}
              </span>
              <div className="grid gap-2">
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) upload.mutate(f)
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    loading={upload.isPending}
                    onClick={() => file.current?.click()}
                  >
                    <Icon name="imageUp" size={20} />
                    {t(p('photo_choose'))}
                  </Button>
                  {d.photo.has && (
                    <Button variant="ghost" onClick={() => remove.mutate()}>
                      {t(
                        p(
                          d.photo.source === 'upload' && d.photo.googleAvailable
                            ? 'photo_back_google'
                            : 'photo_remove',
                        ),
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-ink-muted">
                  {t(
                    p(
                      d.photo.source === 'google'
                        ? 'photo_google'
                        : d.photo.source === 'upload'
                          ? 'photo_upload'
                          : 'photo_generated',
                    ),
                  )}
                </p>
              </div>
            </div>
            {d.photo.has && (
              <div className="grid gap-1">
                <SwitchField
                  label={t(p('avatar_use'))}
                  checked={d.photo.asAvatar}
                  onCheckedChange={(v: boolean) => asAvatar.mutate(v)}
                />
                <p className="text-sm text-ink-muted">{t(p('avatar_help'))}</p>
              </div>
            )}
          </div>

          <div className="pp-block">
            <div>
              <Button
                variant="ghost"
                loading={consent.isPending}
                onClick={() => consent.mutate(false)}
              >
                {t(p('withdraw'))}
              </Button>
            </div>
            <p className="text-sm text-ink-muted">{t(p('withdraw_help'))}</p>
          </div>
        </>
      )}
      <span className="sr-only">{locale}</span>
    </section>
  )
}
