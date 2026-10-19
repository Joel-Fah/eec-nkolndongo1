import { type IconName, iconSvg } from '@eec/ui/icons'

/** Hugeicons stroke-rounded, rendered from the shared registry (no extra runtime). */
export function Icon({ name, size = 20 }: { name: IconName; size?: 16 | 20 | 24 }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG built from our own icon registry
  return (
    <span
      className="inline-flex"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconSvg(name, { size }) }}
    />
  )
}
