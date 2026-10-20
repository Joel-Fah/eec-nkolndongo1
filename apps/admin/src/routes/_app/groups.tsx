import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, EmptyState, SelectField, SwitchField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Illustration } from '../../components/Illustration'
import { Gate, notify, PageHeader, Sheet } from '../../components/kit'
import { bi, type Group } from '../../lib/types'

export const Route = createFileRoute('/_app/groups')({
  component: () => (
    <Gate permission="core:groups-read">
      <Groups />
    </Gate>
  ),
})

const KINDS = ['department', 'committee', 'choir', 'other'] as const

function Groups() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => api<{ groups: Group[] }>('/groups'),
  })
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [viewing, setViewing] = useState<Group | null>(null)
  const canManage = hasPermission(me, 'core:groups-manage')
  const list = groups.data?.groups ?? []
  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('admin.teams.title')}
        lead={t('admin.teams.lead')}
        actions={
          canManage && <Button onClick={() => setEditing('new')}>{t('admin.teams.new')}</Button>
        }
      />
      {groups.data && list.length === 0 ? (
        <EmptyState
          title={t('admin.teams.empty_title')}
          text={t('admin.teams.empty_text')}
          art={<Illustration name="community" />}
        >
          {canManage && <Button onClick={() => setEditing('new')}>{t('admin.teams.new')}</Button>}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <li key={g.id} className="admin-panel" data-inactive={g.isActive ? undefined : ''}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl">{bi(g.nameFr, g.nameEn, locale)}</h2>
                <Badge tone="info">{t(`admin.teams.kinds.${g.kind}` as MessageKey)}</Badge>
                {!g.isActive && <Badge tone="warning">{t('admin.teams.inactive')}</Badge>}
              </div>
              <p className="text-sm text-ink-muted">
                {bi(g.descriptionFr, g.descriptionEn, locale)}
              </p>
              <p className="text-sm">
                {t('admin.teams.members', { n: String(g.members) })} ·{' '}
                {g.leaders.length
                  ? g.leaders.map((l) => l.name).join(', ')
                  : t('admin.teams.no_leaders')}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setViewing(g)}>
                  {t('admin.teams.members_title')}
                </Button>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>
                    {t('admin.common.edit')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Editor
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['groups'] })}
        />
      )}
      {viewing && <Members group={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function Editor({
  group,
  onClose,
  onSaved,
}: {
  group: Group | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useLocale()
  const [form, setForm] = useState({
    nameFr: group?.nameFr ?? '',
    nameEn: group?.nameEn ?? '',
    kind: group?.kind ?? 'department',
    descriptionFr: group?.descriptionFr ?? '',
    descriptionEn: group?.descriptionEn ?? '',
    isActive: group?.isActive ?? true,
  })
  const save = useMutation({
    mutationFn: () =>
      group
        ? api(`/groups/${group.id}`, { method: 'PUT', body: form })
        : api('/groups', { body: form }),
    onSuccess: () => {
      onSaved()
      notify(t(group ? 'admin.teams.saved' : 'admin.teams.created'))
      onClose()
    },
    onError: () => notify(t('admin.common.error'), { tone: 'danger' }),
  })
  const text = (
    key: 'nameFr' | 'nameEn' | 'descriptionFr' | 'descriptionEn',
    label: MessageKey,
    ph: MessageKey,
  ) => (
    <TextField
      label={t(label)}
      placeholder={t(ph)}
      value={form[key]}
      required={key === 'nameFr'}
      onChange={(e: { target: { value: string } }) =>
        setForm((f) => ({ ...f, [key]: e.target.value }))
      }
    />
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={group ? bi(group.nameFr, group.nameEn, 'fr') : t('admin.teams.new')}
    >
      <form className="grid gap-4" onSubmit={submit}>
        {text('nameFr', 'admin.teams.name_fr', 'admin.teams.name_ph')}
        {text('nameEn', 'admin.teams.name_en', 'admin.teams.name_ph')}
        <SelectField
          label={t('admin.teams.kind')}
          value={form.kind}
          onValueChange={(v) => v && setForm((f) => ({ ...f, kind: v as Group['kind'] }))}
          options={KINDS.map((k) => ({
            value: k,
            label: t(`admin.teams.kinds.${k}` as MessageKey),
          }))}
        />
        {text('descriptionFr', 'admin.teams.desc_fr', 'admin.teams.desc_ph')}
        {text('descriptionEn', 'admin.teams.desc_en', 'admin.teams.desc_ph')}
        <SwitchField
          label={t('admin.teams.active')}
          checked={form.isActive}
          onCheckedChange={(on: boolean) => setForm((f) => ({ ...f, isActive: on }))}
        />
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('admin.common.save')}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

function Members({ group, onClose }: { group: Group; onClose: () => void }) {
  const { t, locale } = useLocale()
  const detail = useQuery({
    queryKey: ['group', group.id],
    queryFn: () =>
      api<{ members: { userId: string; name: string; email: string; titleFr: string | null }[] }>(
        `/groups/${group.id}`,
      ),
  })
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={bi(group.nameFr, group.nameEn, locale)}
    >
      <div className="grid gap-4">
        <h3 className="text-lg">{t('admin.teams.leaders')}</h3>
        <p className="text-ink-muted">
          {group.leaders.length
            ? group.leaders.map((l) => l.name).join(', ')
            : t('admin.teams.no_leaders')}
        </p>
        <h3 className="text-lg">{t('admin.teams.members_title')}</h3>
        {detail.data?.members.length ? (
          <ul className="grid gap-2">
            {detail.data.members.map((m) => (
              <li key={m.userId} className="admin-row">
                <Link to="/users/$id" params={{ id: m.userId }} className="font-medium">
                  {m.name}
                </Link>
                <span className="text-sm text-ink-muted">{m.titleFr ?? m.email}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t('admin.teams.members_none')}</p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            {t('admin.common.close')}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
