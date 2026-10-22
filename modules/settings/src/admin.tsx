/**
 * Settings screen (admin, /m/settings). One tab per section; save is per section and audited by the API.
 * Each field shows whether it is approved for the public site; only people with settings:validate can
 * approve, and any edit removes the approval (enforced by the API, mirrored here).
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { getSeason, SEASONS } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  SelectField,
  SwitchField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { type FieldDef, type SectionId, type SectionValues, seasonOptions } from './fields.ts'

type Data = { sections: Record<SectionId, SectionValues>; fields: Record<SectionId, FieldDef[]> }
type Flag = { id: string; label: { fr: string; en: string }; toggleable: boolean; enabled: boolean }

const k = (key: string) => `settings.${key}` as MessageKey

export default function SettingsPage() {
  const { t } = useLocale()
  const me = useMe().data
  const data = useQuery({ queryKey: ['settings'], queryFn: () => api<Data>('/settings') })
  const canEdit = hasPermission(me, 'settings:edit')
  const canValidate = hasPermission(me, 'settings:validate')

  return (
    <div className="grid max-w-4xl gap-8">
      <header className="grid gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="max-w-[60ch] text-ink-muted">{t(k('lead'))}</p>
      </header>
      {data.data ? (
        <TabsBox
          tabs={[
            {
              id: 'parish',
              label: t(k('tabs.parish')),
              content: (
                <SectionForm
                  id="parish"
                  data={data.data}
                  canEdit={canEdit}
                  canValidate={canValidate}
                />
              ),
            },
            {
              id: 'season',
              label: t(k('tabs.season')),
              content: (
                <SectionForm
                  id="season"
                  data={data.data}
                  canEdit={canEdit}
                  canValidate={canValidate}
                />
              ),
            },
            {
              id: 'giving',
              label: t(k('tabs.giving')),
              content: (
                <SectionForm
                  id="giving"
                  data={data.data}
                  canEdit={canEdit}
                  canValidate={canValidate}
                />
              ),
            },
            { id: 'features', label: t(k('tabs.features')), content: <Features /> },
            { id: 'system', label: t(k('tabs.system')), content: <System /> },
          ]}
        />
      ) : (
        <div className="grid gap-3" aria-busy="true">
          <span className="skeleton h-12" />
          <span className="skeleton h-64" />
        </div>
      )}
    </div>
  )
}

function SectionForm({
  id,
  data,
  canEdit,
  canValidate,
}: {
  id: SectionId
  data: Data
  canEdit: boolean
  canValidate: boolean
}) {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [values, setValues] = useState<SectionValues>(data.sections[id])
  useEffect(() => setValues(data.sections[id]), [data, id])
  const save = useMutation({
    mutationFn: () => api<{ changed: number }>(`/settings/${id}`, { method: 'PUT', body: values }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toastManager.add({
        title: t(k(r.changed ? 'saved' : 'nothing')),
        data: { tone: r.changed ? 'success' : 'neutral' },
      })
    },
    onError: (e) =>
      toastManager.add({
        title: t(k((e as { code?: string }).code === 'invalid' ? 'invalid' : 'error')),
        data: { tone: 'danger' },
      }),
  })
  const set = (key: string, patch: Partial<{ value: string; validated: boolean }>) =>
    setValues((v) => {
      const cur = v[key] ?? { value: '', validated: false }
      const next = { ...cur, ...patch }
      // Mirrors the API: an edit removes the approval unless you may approve.
      if (patch.value !== undefined && patch.value !== cur.value && !canValidate)
        next.validated = false
      return { ...v, [key]: next }
    })
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  const flat = Object.fromEntries(Object.entries(values).map(([key, v]) => [key, v.value]))
  const today = getSeason(new Date(), seasonOptions(flat))

  return (
    <form className="grid gap-6 pt-6" onSubmit={onSubmit}>
      {id === 'season' && (
        <p className="w-fit rounded-md bg-primary-soft px-4 py-2 text-sm font-medium text-primary">
          {t(k('season_now'), { season: t(`season.${today}` as MessageKey) })}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {data.fields[id].map((f) => {
          const v = values[f.key] ?? { value: '', validated: false }
          const label = t(k(`fields.${f.key}.label`))
          const help = t(k(`fields.${f.key}.help`))
          return (
            <div
              key={f.key}
              className="grid content-start gap-2 rounded-lg bg-surface p-4 shadow-1"
              data-wide={f.kind === 'textarea' ? '' : undefined}
              style={f.kind === 'textarea' ? { gridColumn: '1 / -1' } : undefined}
            >
              {f.kind === 'season' ? (
                <SelectField
                  label={label}
                  value={v.value || '__none'}
                  onValueChange={(next) =>
                    set(f.key, { value: next && next !== '__none' ? next : '' })
                  }
                  options={[
                    { value: '__none', label: t(k('season_none')) },
                    ...SEASONS.map((s) => ({ value: s, label: t(`season.${s}` as MessageKey) })),
                  ]}
                />
              ) : (
                <TextField
                  label={label}
                  placeholder={t(k(`fields.${f.key}.ph`))}
                  hint={help || undefined}
                  textarea={f.kind === 'textarea'}
                  type={
                    f.kind === 'date'
                      ? 'date'
                      : f.kind === 'email'
                        ? 'email'
                        : f.kind === 'url'
                          ? 'url'
                          : f.kind === 'tel'
                            ? 'tel'
                            : 'text'
                  }
                  inputMode={f.kind === 'number' ? 'decimal' : undefined}
                  lang={locale}
                  value={v.value}
                  readOnly={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    set(f.key, { value: e.target.value })
                  }
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={v.value === '' ? 'info' : v.validated ? 'success' : 'warning'}>
                  {t(
                    k(
                      v.value === ''
                        ? 'status.empty'
                        : v.validated
                          ? 'status.validated'
                          : 'status.pending',
                    ),
                  )}
                </Badge>
                {id !== 'season' && (
                  <SwitchField
                    label={t(k('validate'))}
                    checked={v.validated}
                    disabled={!canValidate || v.value === ''}
                    onCheckedChange={(checked: boolean) => set(f.key, { validated: checked })}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      {id !== 'season' && <p className="text-sm text-ink-muted">{t(k('validate_help'))}</p>}
      {canEdit && (
        <div>
          <Button type="submit" loading={save.isPending}>
            {t(k('save'))}
          </Button>
        </div>
      )}
    </form>
  )
}

function Features() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const flags = useQuery({ queryKey: ['flags'], queryFn: () => api<{ modules: Flag[] }>('/flags') })
  const canToggle = hasPermission(me, 'settings:flags')
  const toggle = useMutation({
    mutationFn: (f: { id: string; enabled: boolean }) =>
      api(`/flags/${f.id}`, { method: 'PUT', body: { enabled: f.enabled } }),
    onSuccess: (_r, f) => {
      qc.invalidateQueries({ queryKey: ['flags'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      const name = flags.data?.modules.find((m) => m.id === f.id)?.label[locale] ?? f.id
      toastManager.add({
        title: t(k(f.enabled ? 'features.toggled_on' : 'features.toggled_off'), { name }),
      })
    },
    onError: () => toastManager.add({ title: t(k('error')), data: { tone: 'danger' } }),
  })
  const optional = flags.data?.modules.filter((m) => m.toggleable) ?? []
  return (
    <div className="grid gap-5 pt-6">
      <p className="max-w-[60ch] text-ink-muted">{t(k('features.lead'))}</p>
      <ul className="grid gap-2">
        {flags.data?.modules.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 shadow-1"
          >
            <span className="font-medium">{m.label[locale]}</span>
            {m.toggleable ? (
              <SwitchField
                label={t(k(m.enabled ? 'features.on' : 'features.off'))}
                checked={m.enabled}
                disabled={!canToggle || toggle.isPending}
                onCheckedChange={(enabled: boolean) => {
                  if (
                    !enabled &&
                    !window.confirm(t(k('features.confirm_off'), { name: m.label[locale] }))
                  )
                    return
                  toggle.mutate({ id: m.id, enabled })
                }}
              />
            ) : (
              <Badge tone="success">{t(k('features.always'))}</Badge>
            )}
          </li>
        ))}
      </ul>
      {flags.data && optional.length === 0 && (
        <p className="text-sm text-ink-muted">{t(k('features.none'))}</p>
      )}
    </div>
  )
}

function System() {
  const { t } = useLocale()
  const me = useMe().data
  return (
    <div className="grid gap-4 pt-6">
      <div className="grid gap-1 rounded-lg bg-surface p-4 shadow-1">
        <p className="font-medium">{t(k('system.version'))}</p>
        <p className="text-sm text-ink-muted">
          {(import.meta as { env?: Record<string, string | undefined> }).env?.VITE_APP_VERSION ??
            'dev'}
        </p>
      </div>
      {hasPermission(me, 'core:system-outbox') && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 shadow-1">
          <div className="grid gap-1">
            <p className="font-medium">{t(k('system.outbox'))}</p>
            <p className="text-sm text-ink-muted">{t(k('system.outbox_text'))}</p>
          </div>
          <a
            className="btn btn-secondary"
            href={`${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}outbox`}
          >
            {t(k('system.open'))}
          </a>
        </div>
      )}
      <div className="grid gap-1 rounded-lg bg-surface p-4 shadow-1">
        <p className="font-medium">{t(k('system.retention'))}</p>
        <p className="text-sm text-ink-muted">{t(k('system.retention_text'))}</p>
      </div>
    </div>
  )
}
