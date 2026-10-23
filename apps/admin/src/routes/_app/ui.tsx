import { api, useLocale } from '@eec/admin-kit'
import { Badge, Button, SwitchField } from '@eec/ui/react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Gate } from '../../components/kit'

// The design guide lives on the public site's internal page (/fr/_brand/); here a banner leads to it.
export const Route = createFileRoute('/_app/ui')({
  component: () => (
    <Gate permission="core:system-design">
      <DesignBanner />
    </Gate>
  ),
})

/**
 * A banner that fills the screen: an illustration at the bottom, a few insight cards and UI pieces floating at different
 * depths (some close and blurred, some far and blurred, the rest sharp) as a tease, and in the middle one call to action to
 * the full guide. The floating pieces are decorative only (hidden from assistive tech and from the pointer).
 */
function DesignBanner() {
  const { t, locale } = useLocale()
  // A random abstract Pexels photo on every visit (nothing is stored); without one the banner keeps its soft gradient.
  const [photo, setPhoto] = useState<{ src: string; photographer: string } | null>(null)
  // Asked once per visit (a ref survives the double run of effects in development, which used to draw two photos, one after the
  // other), and shown only once it has loaded, fading in, so there is never a flash of a first picture.
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    api<{ src: string; photographer: string }>('/banner')
      .then((j) => {
        const img = new Image()
        img.onload = () => setPhoto(j)
        img.src = j.src
      })
      .catch(() => {})
  }, [])
  const cards: { icon: 'sparkles' | 'bookText' | 'checklist'; text: string; at: string }[] = [
    { icon: 'sparkles', text: t('ui.tease_colour'), at: 'a' },
    { icon: 'bookText', text: t('ui.tease_type'), at: 'b' },
    { icon: 'checklist', text: t('ui.tease_parts'), at: 'c' },
  ]
  return (
    <section className="dg" aria-labelledby="dg-title">
      {photo && <img className="dg-photo" src={photo.src} alt="" />}
      {photo && <p className="dg-credit">{t('ui.photo_credit', { name: photo.photographer })}</p>}
      <div className="dg-float" aria-hidden="true" inert>
        {cards.map((c) => (
          <div key={c.at} className="dg-card" data-at={c.at}>
            <span className="insight-icon">
              <Icon name={c.icon} size={20} />
            </span>
            <p className="insight-text">{c.text}</p>
          </div>
        ))}
        <div className="dg-bit" data-at="d">
          <Button size="sm">{t('ui.tease_button')}</Button>
        </div>
        <div className="dg-bit" data-at="e">
          <Badge tone="success">{t('ui.tease_badge')}</Badge>
        </div>
        <div className="dg-bit dg-switch" data-at="f">
          <SwitchField label={t('ui.tease_switch')} checked readOnly />
        </div>
        <div className="dg-bit" data-at="g">
          <Button size="sm" variant="secondary">
            {t('ui.tease_secondary')}
          </Button>
        </div>
      </div>
      <div className="dg-cta">
        <h1 id="dg-title" className="text-4xl">
          {t('ui.cta_t')}
        </h1>
        <p className="text-lg text-ink-muted">{t('ui.cta_p')}</p>
        <a className="btn btn-primary" href={`/${locale}/_brand/`}>
          {t('ui.cta')}
          <Icon name="arrowRight" size={20} />
        </a>
      </div>
    </section>
  )
}
