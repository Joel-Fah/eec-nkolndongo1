import { ApiError, api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, CheckboxField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { Confirm, Gate, notify, PageHeader, Sheet } from '../../components/kit'
import { bi, type Role } from '../../lib/types'

export const Route = createFileRoute('/_app/roles')({
  component: () => (
    <Gate permission="core:roles-read">
      <Roles />
    </Gate>
  ),
})

type Perm = {
  key: string
  labelFr: string
  labelEn: string | null
  descriptionFr: string | null
  descriptionEn: string | null
  dangerous: boolean
}
type Catalog = { modules: { id: string; label: { fr: string; en: string }; permissions: Perm[] }[] }

const errKey = (e: unknown): MessageKey =>
  e instanceof ApiError && e.code === 'in_use'
    ? 'admin.roles.err_in_use'
    : e instanceof ApiError && e.code === 'system_role'
      ? 'admin.roles.err_system'
      : 'admin.common.error'

function Roles() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<{ roles: Role[] }>('/roles') })
  const catalog = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api<Catalog>('/roles/permissions'),
  })
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)
  const canManage = hasPermission(me, 'core:roles-manage')
  const refresh = () => qc.invalidateQueries({ queryKey: ['roles'] })

  const duplicate = (r: Role) =>
    api(`/roles/${r.id}/duplicate`, { body: {} })
      .then(() => {
        refresh()
        notify(t('admin.roles.duplicated'))
      })
      .catch((e) => notify(t(errKey(e)), { tone: 'danger' }))

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('admin.roles.title')}
        lead={t('admin.roles.lead')}
        actions={
          canManage && <Button onClick={() => setEditing('new')}>{t('admin.roles.new')}</Button>
        }
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(roles.data?.roles ?? []).map((r) => (
          <li key={r.id} className="admin-panel">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl">{bi(r.nameFr, r.nameEn, locale)}</h2>
              {r.isSystem && <Badge tone="info">{t('admin.roles.system')}</Badge>}
            </div>
            <p className="text-sm text-ink-muted">{bi(r.descriptionFr, r.descriptionEn, locale)}</p>
            <p className="flex flex-wrap gap-3 text-sm">
              <span>{t('admin.roles.users_count', { n: String(r.users) })}</span>
              <span className="text-ink-muted">·</span>
              <span>
                {r.key === 'super-admin'
                  ? '∞'
                  : t('admin.roles.count_rights', { n: String(r.permissions.length) })}
              </span>
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                {canManage ? t('admin.common.edit') : t('admin.roles.rights')}
              </Button>
              {canManage && r.key !== 'super-admin' && (
                <Button variant="ghost" size="sm" onClick={() => duplicate(r)}>
                  {t('admin.roles.duplicate')}
                </Button>
              )}
              {canManage && !r.isSystem && (
                <Button variant="ghost" size="sm" onClick={() => setDeleting(r)}>
                  {t('admin.roles.delete')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing && catalog.data && (
        <Editor
          role={editing === 'new' ? null : editing}
          catalog={catalog.data}
          readOnly={!canManage}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('admin.roles.delete')}
        text={t('admin.roles.delete_text')}
        confirmLabel={t('admin.roles.delete')}
        danger
        word={deleting ? bi(deleting.nameFr, deleting.nameEn, locale) : undefined}
        onConfirm={() => {
          const r = deleting
          setDeleting(null)
          if (r)
            api(`/roles/${r.id}`, { method: 'DELETE' })
              .then(() => {
                refresh()
                notify(t('admin.roles.deleted'))
              })
              .catch((e) => notify(t(errKey(e)), { tone: 'danger' }))
        }}
      />
    </div>
  )
}

function Editor({
  role,
  catalog,
  readOnly,
  onClose,
  onSaved,
}: {
  role: Role | null
  catalog: Catalog
  readOnly: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t, locale } = useLocale()
  const isSuper = role?.key === 'super-admin'
  const [form, setForm] = useState({
    nameFr: role?.nameFr ?? '',
    nameEn: role?.nameEn ?? '',
    descriptionFr: role?.descriptionFr ?? '',
    descriptionEn: role?.descriptionEn ?? '',
  })
  const [rights, setRights] = useState<Set<string>>(new Set(role?.permissions ?? []))
  useEffect(() => setRights(new Set(role?.permissions ?? [])), [role])
  const save = useMutation({
    mutationFn: () =>
      role
        ? api(`/roles/${role.id}`, { method: 'PUT', body: { ...form, permissions: [...rights] } })
        : api('/roles', { body: { ...form, permissions: [...rights] } }),
    onSuccess: () => {
      onSaved()
      notify(t(role ? 'admin.roles.saved' : 'admin.roles.created'))
      onClose()
    },
    onError: () => notify(t('admin.common.error'), { tone: 'danger' }),
  })
  const toggle = (key: string, on: boolean) =>
    setRights((s) => {
      const n = new Set(s)
      if (on) n.add(key)
      else n.delete(key)
      return n
    })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  const text = (
    key: 'nameFr' | 'nameEn' | 'descriptionFr' | 'descriptionEn',
    label: MessageKey,
    ph: MessageKey,
  ) => (
    <TextField
      label={t(label)}
      placeholder={t(ph)}
      value={form[key]}
      readOnly={readOnly}
      required={key === 'nameFr'}
      onChange={(e: { target: { value: string } }) =>
        setForm((f) => ({ ...f, [key]: e.target.value }))
      }
    />
  )
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={role ? t('admin.roles.edit_title') : t('admin.roles.new_title')}
      wide
    >
      <form className="grid gap-6" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          {text('nameFr', 'admin.roles.name_fr', 'admin.roles.name_ph')}
          {text('nameEn', 'admin.roles.name_en', 'admin.roles.name_ph')}
          {text('descriptionFr', 'admin.roles.desc_fr', 'admin.roles.desc_ph')}
          {text('descriptionEn', 'admin.roles.desc_en', 'admin.roles.desc_ph')}
        </div>
        <div className="grid gap-3">
          <h3 className="text-xl">{t('admin.roles.rights')}</h3>
          <p className="text-sm text-ink-muted">
            {isSuper ? t('admin.roles.super_note') : t('admin.roles.rights_help')}
          </p>
          {!isSuper &&
            catalog.modules.map((m) => {
              const keys = m.permissions.map((p) => p.key)
              const all = keys.every((k) => rights.has(k))
              return (
                <fieldset key={m.id} className="admin-matrix" disabled={readOnly}>
                  <legend className="admin-matrix-head">
                    <span className="font-semibold">{m.label[locale]}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        for (const k of keys) toggle(k, !all)
                      }}
                    >
                      {all ? t('admin.roles.unselect_all') : t('admin.roles.select_all')}
                    </Button>
                  </legend>
                  {m.permissions.map((p) => (
                    <div key={p.key} className="admin-matrix-row">
                      <CheckboxField
                        label={bi(p.labelFr, p.labelEn, locale)}
                        checked={rights.has(p.key)}
                        onCheckedChange={(on: boolean) => toggle(p.key, on)}
                      />
                      {p.dangerous && <Badge tone="warning">{t('admin.common.sensitive')}</Badge>}
                      {(p.descriptionFr || p.descriptionEn) && (
                        <p className="admin-matrix-help">
                          {bi(p.descriptionFr, p.descriptionEn, locale)}
                        </p>
                      )}
                    </div>
                  ))}
                </fieldset>
              )
            })}
        </div>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="submit" loading={save.isPending}>
              {t('admin.common.save')}
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
