/**
 * Group announcements (admin, /m/announcements): a leader writes a short message for their group, publishes it (each member gets a
 * notification in Mon espace) and takes it down when it is over. A leader only sees their own groups.
 */
import { api, DateField, useLocale } from '@eec/admin-kit'
import { ConfirmDialog } from '@eec/content-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, EmptyState, SelectField, TextField, toastManager } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

const k = (key: string) => `announcements.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })

type G = {
  id: string
  nameFr: string
  nameEn: string | null
  canEdit: boolean
  canPublish: boolean
}
type Item = {
  id: string
  groupId: string
  titleFr: string
  titleEn: string
  bodyFr: string
  bodyEn: string
  linkUrl: string
  state: 'draft' | 'published' | 'expired'
  publishedAt: string | null
  expiresOn: string
}
const blank = { titleFr: '', titleEn: '', bodyFr: '', bodyEn: '', linkUrl: '', expiresOn: '' }

export default function Announcements() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const groups = useQuery({
    queryKey: ['ann-groups'],
    queryFn: () => api<{ groups: G[] }>('/announcements/groups'),
  })
  const list = groups.data?.groups ?? []
  const [picked, setPicked] = useState('')
  const groupId = picked || list[0]?.id || ''
  const group = list.find((g) => g.id === groupId)
  const items = useQuery({
    queryKey: ['ann', groupId],
    enabled: !!groupId,
    queryFn: () => api<{ items: Item[] }>(`/announcements?groupId=${groupId}`),
  })
  const [editing, setEditing] = useState<{ id: string | null; f: typeof blank } | null>(null)
  const [confirm, setConfirm] = useState<{
    kind: 'publish' | 'expire' | 'delete'
    item: Item
  } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['ann', groupId] })
  const save = useMutation({
    mutationFn: (e: NonNullable<typeof editing>) =>
      e.id
        ? api(`/announcements/${e.id}`, { method: 'PUT', body: { groupId, ...e.f } })
        : api('/announcements', { method: 'POST', body: { groupId, ...e.f } }),
    onSuccess: () => {
      setEditing(null)
      notify(t(k('saved')))
      void refresh()
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const act = useMutation({
    mutationFn: ({ kind, item }: NonNullable<typeof confirm>) =>
      kind === 'delete'
        ? api(`/announcements/${item.id}`, { method: 'DELETE' })
        : api(`/announcements/${item.id}/${kind}`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setConfirm(null)
      notify(t(k('done')))
      void refresh()
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const name = (g: G) => (locale === 'en' && g.nameEn) || g.nameFr
  const tone = (s: Item['state']) =>
    s === 'published' ? 'success' : s === 'draft' ? 'gold' : 'info'
  const set = (key: keyof typeof blank) => (e: { target: { value: string } }) =>
    editing && setEditing({ ...editing, f: { ...editing.f, [key]: e.target.value } })

  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="text-3xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>
      {groups.isSuccess && !list.length ? (
        <EmptyState title={t(k('no_group_t'))} text={t(k('no_group_p'))} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <SelectField
              label={t(k('group'))}
              value={groupId}
              onValueChange={(v) => v && setPicked(v)}
              options={list.map((g) => ({ value: g.id, label: name(g) }))}
            />
            {group?.canEdit && (
              <Button onClick={() => setEditing({ id: null, f: blank })}>{t(k('new'))}</Button>
            )}
          </div>
          {editing && (
            <form
              className="admin-panel grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(editing)
              }}
            >
              <TextField
                label={t(k('f_title_fr'))}
                placeholder={t(k('ph_title'))}
                value={editing.f.titleFr}
                onChange={set('titleFr')}
                required
                maxLength={100}
              />
              <TextField
                label={t(k('f_body_fr'))}
                placeholder={t(k('ph_body'))}
                textarea
                rows={4}
                value={editing.f.bodyFr}
                onChange={set('bodyFr')}
                required
                maxLength={1000}
              />
              <TextField
                label={t(k('f_title_en'))}
                placeholder={t(k('ph_title_en'))}
                value={editing.f.titleEn}
                onChange={set('titleEn')}
                maxLength={100}
              />
              <TextField
                label={t(k('f_body_en'))}
                placeholder={t(k('ph_body_en'))}
                textarea
                rows={3}
                value={editing.f.bodyEn}
                onChange={set('bodyEn')}
                maxLength={1000}
              />
              <TextField
                label={t(k('f_link'))}
                hint={t(k('f_link_hint'))}
                placeholder="/fr/agenda/"
                value={editing.f.linkUrl}
                onChange={set('linkUrl')}
                maxLength={300}
              />
              <DateField
                label={t(k('f_expires'))}
                hint={t(k('f_expires_hint'))}
                value={editing.f.expiresOn}
                onChange={(v: string) =>
                  setEditing({ ...editing, f: { ...editing.f, expiresOn: v } })
                }
              />
              <div className="flex gap-2">
                <Button type="submit" loading={save.isPending}>
                  {t(k('save'))}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  {t(k('cancel'))}
                </Button>
              </div>
            </form>
          )}
          {items.isSuccess && !items.data.items.length && !editing && (
            <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
          )}
          <ul className="grid gap-3">
            {(items.data?.items ?? []).map((a) => (
              <li key={a.id} className="admin-panel grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{(locale === 'en' && a.titleEn) || a.titleFr}</strong>
                  <Badge tone={tone(a.state)}>{t(k(`state_${a.state}`))}</Badge>
                </div>
                <p className="whitespace-pre-line text-ink-muted">
                  {(locale === 'en' && a.bodyEn) || a.bodyFr}
                </p>
                {a.expiresOn && (
                  <p className="text-sm text-ink-muted">{t(k('until'), { date: a.expiresOn })}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {group?.canEdit && a.state !== 'expired' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: a.id,
                          f: {
                            titleFr: a.titleFr,
                            titleEn: a.titleEn,
                            bodyFr: a.bodyFr,
                            bodyEn: a.bodyEn,
                            linkUrl: a.linkUrl,
                            expiresOn: a.expiresOn,
                          },
                        })
                      }
                    >
                      {t(k('edit'))}
                    </Button>
                  )}
                  {group?.canPublish && a.state === 'draft' && (
                    <Button size="sm" onClick={() => setConfirm({ kind: 'publish', item: a })}>
                      {t(k('publish'))}
                    </Button>
                  )}
                  {group?.canPublish && a.state === 'published' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirm({ kind: 'expire', item: a })}
                    >
                      {t(k('expire'))}
                    </Button>
                  )}
                  {group?.canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirm({ kind: 'delete', item: a })}
                    >
                      {t(k('delete'))}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? t(k(`${confirm.kind}_t`)) : ''}
        text={confirm ? t(k(`${confirm.kind}_p`)) : ''}
        confirmLabel={confirm ? t(k(confirm.kind)) : ''}
        danger={confirm?.kind === 'delete'}
        busy={act.isPending}
        onConfirm={() => confirm && act.mutate(confirm)}
      />
    </div>
  )
}
