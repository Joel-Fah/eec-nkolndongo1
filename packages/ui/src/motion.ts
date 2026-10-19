/** GSAP presets matching the CSS motion tokens (tokens.ts → motion). */
import { motion } from './tokens.ts'

export const ease = {
  /** ≈ cubic-bezier(0.22, 1, 0.36, 1) */
  out: 'expo.out',
  inOut: 'power3.inOut',
  /** Illustrations only: a touch of overshoot is allowed there, never on UI. */
  playful: 'back.out(1.6)',
  idle: 'sine.inOut',
} as const

export const duration = {
  micro: motion.duration.micro.normal / 1000,
  ui: motion.duration.ui.normal / 1000,
  story: motion.duration.story.normal / 1000,
} as const

export const media = {
  full: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const

/** Data saver on: keep the page still (no idle loops, no scroll scrubbing). */
export function prefersSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return connection?.saveData === true
}
