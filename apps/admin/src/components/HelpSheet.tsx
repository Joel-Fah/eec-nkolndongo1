import { Dialog } from '@base-ui/react/dialog'
import { hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { Badge } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { GUIDES, loadGuide, MEMOS } from '../lib/help'
import { renderMarkdown } from '../lib/markdown'
import { AbstractBanner } from './AbstractBanner'
import { Icon } from './Icon'

/**
 * The guide for the screen you are on, as a side sheet over it: nothing behind it changes, so closing it puts you
 * exactly where you were. An abstract banner (different every time) carries the title and the useful details, then
 * the guide. Top left: the whole Help as a page; top right: close.
 */
export function HelpSheet({
  slug,
  onOpenChange,
}: {
  slug: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const guide = [...GUIDES, ...MEMOS].find((g) => g.slug === slug)
  const q = useQuery({
    queryKey: ['help', slug, locale],
    enabled: !!slug,
    queryFn: async () => {
      const md = slug ? await loadGuide(slug, locale) : null
      return md ? renderMarkdown(md) : null
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
  // A new composition each time the sheet opens on a guide.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the slug is the trigger for a fresh seed
  const seed = useMemo(() => Math.floor(Math.random() * 2 ** 31), [slug])
  const minutes = q.data
    ? Math.max(1, Math.round(q.data.html.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 180))
    : null
  const relevant = !guide?.permission || hasPermission(me, guide.permission)
  return (
    <Dialog.Root open={!!slug} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="sheet eec-sheet help-sheet" data-side="end">
          <div className="help-sheet-bar">
            <Link className="btn btn-ghost btn-sm" to="/help" onClick={() => onOpenChange(false)}>
              <Icon name="arrowLeft" size={16} />
              {t('admin.help.back')}
            </Link>
            <Dialog.Close
              className="btn btn-ghost btn-icon"
              aria-label={t('admin.help.close')}
              data-tip={t('admin.help.close')}
              data-tip-end
            >
              <Icon name="close" size={20} />
            </Dialog.Close>
          </div>
          <div className="help-sheet-hero">
            <AbstractBanner seed={seed} />
            <div className="help-sheet-title">
              {guide && (
                <span className="help-sheet-icon" aria-hidden="true">
                  <Icon name={guide.icon} size={24} />
                </span>
              )}
              <Dialog.Title className="help-sheet-h">
                {q.data?.title || guide?.title[locale] || ''}
              </Dialog.Title>
              <Dialog.Description className="help-sheet-sub">
                {guide?.summary[locale]}
              </Dialog.Description>
              <div className="help-sheet-meta">
                {minutes && (
                  <Badge>
                    <Icon name="clock" size={16} />
                    {t('admin.help.minutes', { n: String(minutes) })}
                  </Badge>
                )}
                {guide?.permission && (
                  <Badge tone={relevant ? 'success' : 'warning'}>
                    {t(relevant ? 'admin.help.for_you' : 'admin.help.not_for_you')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div
            className="help-sheet-body help-body"
            dangerouslySetInnerHTML={{ __html: q.data?.html ?? '' }}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
