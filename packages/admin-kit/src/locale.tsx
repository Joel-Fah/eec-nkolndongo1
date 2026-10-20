import { createT, type Locale, pickLocale, type Translate } from '@eec/i18n'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'eec-admin-locale'

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    // storage blocked: fall through to the browser language
  }
  return pickLocale(navigator.languages?.join(',') ?? navigator.language)
}

const Context = createContext<{
  locale: Locale
  setLocale: (l: Locale) => void
  t: Translate
} | null>(null)

/** Locale: saved choice → browser language → French. Same messages as the public site. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const value = useMemo(
    () => ({
      locale,
      t: createT(locale),
      setLocale: (next: Locale) => {
        setLocaleState(next)
        try {
          localStorage.setItem(KEY, next)
        } catch {
          // ignore
        }
      },
    }),
    [locale],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useLocale() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('LocaleProvider missing')
  return ctx
}
export const useT = () => useLocale().t
