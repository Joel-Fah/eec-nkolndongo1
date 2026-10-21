/** The lifecycle label every content list shows: same words, same colours, in every module. */
import { useLocale } from '@eec/admin-kit'
import type { Status } from '@eec/core'
import { Badge } from '@eec/ui/react'

const TONE = {
  draft: 'info',
  scheduled: 'gold',
  published: 'success',
  archived: 'warning',
} as const

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useLocale()
  return <Badge tone={TONE[status]}>{t(`content.status.${status}`)}</Badge>
}
