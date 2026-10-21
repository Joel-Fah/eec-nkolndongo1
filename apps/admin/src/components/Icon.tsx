import { type IconName, iconSvg } from '@eec/ui/icons'

/** Hugeicons stroke-rounded, rendered from the shared registry (no extra runtime). */
export function Icon({ name, size = 20 }: { name: IconName; size?: 16 | 20 | 24 }) {
  return (
    <span
      className="inline-flex"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconSvg(name, { size }) }}
    />
  )
}
