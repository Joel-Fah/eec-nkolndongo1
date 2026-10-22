import { useLocale } from '@eec/admin-kit'
import { Badge, Button, SwitchField } from '@eec/ui/react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Illustration } from '../../components/Illustration'
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
  // An abstract Pexels photo behind everything (fetched by `pnpm pexels:banner`); without it the banner keeps its soft gradient.
  const base = import.meta.env.BASE_URL
  const [photo, setPhoto] = useState<{ photographer: string } | null>(null)
  useEffect(() => {
    fetch(`${base}design-banner.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setPhoto(j))
      .catch(() => {})
  }, [base])
  const cards: { icon: 'sparkles' | 'bookText' | 'checklist'; text: string; at: string }[] = [
    { icon: 'sparkles', text: t('ui.tease_colour'), at: 'a' },
    { icon: 'bookText', text: t('ui.tease_type'), at: 'b' },
    { icon: 'checklist', text: t('ui.tease_parts'), at: 'c' },
  ]
  return (
    <section className="dg" aria-labelledby="dg-title">
      {photo && <img className="dg-photo" src={`${base}design-banner.webp`} alt="" />}
      {photo && <p className="dg-credit">{t('ui.photo_credit', { name: photo.photographer })}</p>}
      <div className="dg-art">
        <Illustration name="working-from-anywhere" />
      </div>
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
