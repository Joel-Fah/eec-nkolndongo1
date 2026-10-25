import { abstractArt, THEME_COLORS } from '@eec/ui/abstract-art'
import { useMemo } from 'react'

/**
 * An abstract banner drawn on the fly, in the same gentle manner as the generated banners of the public site (events with
 * no photo): soft translucent circles, wide faint rings, dotted arcs, a field of dots and a low wave, in one of our tone
 * families. A different composition each time; light and dark follow because colours are tokens. Decorative only.
 * The drawing itself is `abstractArt` (packages/ui), shared with the social media kit.
 */
export function AbstractBanner({ seed }: { seed: number }) {
  const art = useMemo(
    () => abstractArt({ seed, width: 1200, height: 480, colors: THEME_COLORS }),
    [seed],
  )
  return (
    <svg
      className="abstract-banner"
      viewBox="0 0 1200 480"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markup built from numbers and our own colour tokens
      dangerouslySetInnerHTML={{ __html: art }}
    />
  )
}
