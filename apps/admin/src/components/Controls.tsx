import { useLocale } from '../lib/locale'
import { useTheme } from '../lib/theme'
import { Icon } from './Icon'

export function ThemeButton() {
  const { choice, cycle } = useTheme()
  const { t } = useLocale()
  const label =
    choice === 'light'
      ? t('common.theme.light')
      : choice === 'dark'
        ? t('common.theme.dark')
        : t('common.theme.system')
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={cycle}
      aria-label={label}
      title={t('common.theme.toggle')}
    >
      <Icon name={choice === 'light' ? 'sun' : choice === 'dark' ? 'moon' : 'system'} />
    </button>
  )
}

export function LocaleSwitch() {
  const { locale, setLocale, t } = useLocale()
  const next = locale === 'fr' ? 'en' : 'fr'
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      lang={next}
      onClick={() => setLocale(next)}
      aria-label={t('common.language.switch_label')}
    >
      <Icon name="language" size={16} />
      {t('common.language.switch_to')}
    </button>
  )
}
