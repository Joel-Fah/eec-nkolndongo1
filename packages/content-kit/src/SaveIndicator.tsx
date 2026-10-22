import { useLocale } from '@eec/admin-kit'
import type { SaveState } from './autosave.ts'

export function SaveIndicator({ state }: { state: SaveState }) {
  const { t } = useLocale()
  if (state === 'idle') return null
  return (
    <output className="save-indicator" data-state={state} aria-live="polite">
      {t(`content.save.${state}`)}
    </output>
  )
}
