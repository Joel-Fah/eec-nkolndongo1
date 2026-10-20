import { useCallback, useEffect, useState } from 'react'

const KEY = 'eec-theme'
export type ThemeChoice = 'system' | 'light' | 'dark'
const order: ThemeChoice[] = ['system', 'light', 'dark']

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // ignore
  }
  return 'system'
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  root.dataset.themeChoice = choice
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = choice
}

/** system → light → dark, persisted. The inline script in index.html applies it before first paint. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read)
  useEffect(() => apply(choice), [choice])
  const cycle = useCallback(() => {
    setChoice((current) => {
      const next = order[(order.indexOf(current) + 1) % order.length] ?? 'system'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const set = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // ignore
    }
    setChoice(next)
  }, [])
  return { choice, cycle, set }
}
