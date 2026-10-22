/**
 * Saves a draft by itself a moment after the last keystroke, and says so (« Enregistré »). A failure retries
 * and is shown plainly; leaving the page with unsaved changes asks first. Editors never have to « save ».
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function useAutosave<T>(
  value: T | null,
  save: (v: T) => Promise<void>,
  { delay = 1200 }: { delay?: number } = {},
) {
  const [state, setState] = useState<SaveState>('idle')
  const lastSaved = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(value)
  const saver = useRef(save)
  const busy = useRef(false)
  saver.current = save
  latest.current = value

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const v = latest.current
    if (v === null || busy.current) return
    const snapshot = JSON.stringify(v)
    if (snapshot === lastSaved.current) return
    busy.current = true
    setState('saving')
    try {
      await saver.current(v)
      lastSaved.current = snapshot
      setState(JSON.stringify(latest.current) === snapshot ? 'saved' : 'dirty')
    } catch {
      setState('error')
      timer.current = setTimeout(flush, 5000)
    } finally {
      busy.current = false
    }
    if (JSON.stringify(latest.current) !== lastSaved.current && state !== 'error')
      timer.current = setTimeout(flush, delay)
  }, [delay, state])

  // The first value is the saved one: nothing to send until it changes.
  useEffect(() => {
    if (value === null) return
    const snapshot = JSON.stringify(value)
    if (lastSaved.current === null) {
      lastSaved.current = snapshot
      return
    }
    if (snapshot === lastSaved.current) return
    setState((s) => (s === 'saving' ? s : 'dirty'))
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
    return () => clearTimeout(timer.current)
  }, [value, delay, flush])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === 'dirty' || state === 'saving' || state === 'error') e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state])

  /** Mark the current value as the saved one (after loading or after a restore). */
  const reset = useCallback((v: T) => {
    lastSaved.current = JSON.stringify(v)
    setState('idle')
  }, [])

  return { state, flush, reset }
}
