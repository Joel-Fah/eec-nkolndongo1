/** List / grid / calendar switch: icons with names for assistive technology and a tooltip. */
import type { IconName } from '@eec/ui/icons'
import { Icon, ShortcutTip } from '@eec/ui/react'

export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string; icon: IconName }[]
  label: string
}) {
  return (
    <fieldset className="seg" aria-label={label}>
      {options.map((o) => (
        <ShortcutTip key={o.id} label={o.label}>
          <button
            type="button"
            className="seg-btn seg-icon"
            aria-pressed={value === o.id}
            aria-label={o.label}
            onClick={() => onChange(o.id)}
          >
            <Icon name={o.icon} size={20} />
          </button>
        </ShortcutTip>
      ))}
    </fieldset>
  )
}
