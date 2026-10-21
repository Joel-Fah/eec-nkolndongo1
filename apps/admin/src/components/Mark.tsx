import mark from '@eec/ui/brand/mark.svg?raw'
import halo from '@eec/ui/brand/mark-halo.svg?raw'
import { useId } from 'react'

/** The EEC mark (inline SVG; ids made unique per instance). Never restyle its shapes. */
export function Mark({
  variant = 'mark',
  label,
  className,
}: {
  variant?: 'mark' | 'halo'
  label?: string
  className?: string
}) {
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  let svg = (variant === 'halo' ? halo : mark).replace(
    /(id="|href="#|url\(#)(eec[a-z]*-)/g,
    `$1${uid}-$2`,
  )
  svg = label
    ? svg.replace(/<title>[^<]*<\/title>/, `<title>${label}</title>`)
    : svg.replace(' role="img"', ' aria-hidden="true"').replace(/<title>[^<]*<\/title>/, '')
  return (
    <span
      className={className}
      style={{ display: 'inline-flex' }}
      dangerouslySetInnerHTML={{
        __html: svg.replace('<svg ', '<svg style="height:100%;width:auto" '),
      }}
    />
  )
}
