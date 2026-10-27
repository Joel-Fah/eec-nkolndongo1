/**
 * « Demander la publication »: for someone who writes but may not publish (a group leader). It tells the people who may
 * (the secretariat, a notification each) and shows that the request is waiting, until the item is published.
 * The editor's own autosave is flushed first, so they review what was just typed.
 */
import { ApiError, api, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Button } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const k = (key: string) => `content.request.${key}` as MessageKey

export function RequestPublication({
  base,
  id,
  flush,
  onMessage,
}: {
  /** The module's API path, e.g. `/news`. */
  base: string
  id: string
  /** Saves what is being typed before asking. */
  flush: () => Promise<unknown>
  onMessage: (text: string, tone?: 'danger') => void
}) {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const state = useQuery({
    queryKey: ['request-publication', base, id],
    queryFn: () =>
      api<{ requested: boolean; at: string | null }>(`${base}/${id}/request-publication`),
  })
  const ask = useMutation({
    mutationFn: async () => {
      await flush()
      return api<{ asked: number }>(`${base}/${id}/request-publication`, {
        method: 'POST',
        body: {},
      })
    },
    onSuccess: (r) => {
      onMessage(t(k('sent'), { n: String(r.asked) }))
      qc.invalidateQueries({ queryKey: ['request-publication', base, id] })
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : ''
      onMessage(
        t(k(code === 'not_ready' ? 'not_ready' : code === 'nobody' ? 'nobody' : 'error')),
        'danger',
      )
    },
  })
  const at = state.data?.at
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        timeZone: 'Africa/Douala',
      }).format(new Date(state.data.at))
    : ''
  return (
    <div className="grid gap-2">
      {state.data?.requested ? (
        <p className="text-sm text-ink-muted" role="status">
          {t(k('waiting'), { date: at })}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">{t(k('help'))}</p>
      )}
      <div>
        <Button
          variant={state.data?.requested ? 'secondary' : 'primary'}
          loading={ask.isPending}
          onClick={() => ask.mutate()}
        >
          {t(k(state.data?.requested ? 'again' : 'button'))}
        </Button>
      </div>
    </div>
  )
}
