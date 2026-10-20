/**
 * Page heroes (Joël, 2026-10-20): the photo is cut into a playful shape, and cards are scattered over it
 * at hand-placed positions — some overflow the picture to the left, right or below, never above it.
 * Three pages open with a full-screen photo that shrinks into a rounded shape as you scroll (`morph`).
 * No illustrations in heroes. Photos are dev-only placeholders (lib/placeholders.ts): without them each
 * layout keeps its shape on a tinted, textured panel.
 * Figures are facts: `value` stays null until validated; in dev the `example` is shown, tagged « exemple ».
 */
import type { MessageKey as K } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'
import type { ShapeId } from './shapes.ts'

/** split-*: text beside the shape · centered: text above it · morph: full-screen, shrinks on scroll. */
export type HeroLayout = 'split-right' | 'split-left' | 'centered' | 'morph' | 'plain'

/**
 * Where a card sits, in % of the picture's box (of the viewport for `morph`). x may be negative or past 100
 * (overflow left/right); y starts at 0 and may pass 100 (overflow below). Never above: y is clamped to ≥ 0.
 */
export type Place = { x: number; y: number; r?: number }
export type HeroCard = (
  | { kind: 'stat'; label: K; value: number | null; example: number; suffix?: string }
  | { kind: 'info'; icon: IconName; title: K; text: K }
  /** A numbered step (the practical-life paths). */
  | { kind: 'step'; n: number; title: K; text: K }
  | { kind: 'season' }
  | { kind: 'progress'; label: K; value: number | null; example: number }
  | { kind: 'player'; title: K; text: K }
) & { at: Place }
export type Hero = {
  layout: HeroLayout
  shape: ShapeId
  photos: number[]
  cards: HeroCard[]
  /** A very large word in the text column. */
  giant?: 'season' | 'thanks'
}

const k = (key: string) => key as K
const stat = (label: string, example: number, at: Place, suffix?: string): HeroCard => ({
  kind: 'stat',
  label: k(`hero.stats.${label}`),
  value: null,
  example,
  suffix,
  at,
})
const info = (icon: IconName, title: string, text: string, at: Place): HeroCard => ({
  kind: 'info',
  icon,
  title: k(title),
  text: k(text),
  at,
})
const step = (n: number, title: string, at: Place): HeroCard => ({
  kind: 'step',
  n,
  title: k(title),
  text: k('hero.path_step'),
  at,
})

export const heroes: Record<string, Hero> = {
  histoire: {
    layout: 'morph',
    shape: 'squircle',
    photos: [17290989],
    cards: [
      stat('years', 60, { x: 4, y: 58, r: -3 }, '+'),
      stat('pastors', 12, { x: 70, y: 22, r: 3 }),
      stat('generations', 3, { x: 62, y: 74, r: -2 }),
    ],
  },
  croyances: {
    layout: 'split-right',
    shape: 'windows',
    photos: [15382617],
    cards: [
      info('bible', 'pages.croyances.c1_t', 'pages.croyances.c1_p', { x: -22, y: 34, r: -2 }),
      info('gift', 'pages.croyances.c2_t', 'pages.croyances.c2_p', { x: 54, y: 84, r: 2 }),
    ],
  },
  pasteurs: {
    layout: 'split-left',
    shape: 'blocks',
    photos: [9056625],
    cards: [
      stat('pastors_now', 2, { x: 66, y: 4, r: 3 }),
      stat('council', 12, { x: -10, y: 74, r: -3 }),
    ],
  },
  trouver: {
    layout: 'morph',
    shape: 'squircle',
    photos: [31326469],
    cards: [
      info('location', 'footer.visit', 'footer.address', { x: 5, y: 62, r: -2 }),
      info('clock', 'footer.hours_title', 'footer.hours', { x: 62, y: 70, r: 2 }),
    ],
  },
  cultes: {
    layout: 'split-right',
    shape: 'blob',
    photos: [8270597],
    cards: [
      stat('services_week', 3, { x: -16, y: 12, r: -3 }),
      stat('minutes', 150, { x: 64, y: 56, r: 3 }),
      info('users', 'hero.cultes_all_t', 'hero.cultes_all_p', { x: 4, y: 88, r: -1 }),
    ],
  },
  departements: {
    layout: 'split-left',
    shape: 'flower',
    photos: [32037766],
    cards: [stat('groups', 12, { x: 66, y: 6, r: 3 }), stat('ages', 5, { x: -12, y: 76, r: -3 })],
  },
  pratique: {
    layout: 'split-right',
    shape: 'leaf',
    photos: [32632180],
    cards: [
      step(1, 'pages.pratique.c1_t', { x: -18, y: 6, r: -2 }),
      step(2, 'pages.pratique.c2_t', { x: 60, y: 2, r: 2 }),
      step(3, 'pages.pratique.c3_t', { x: -10, y: 62, r: 2 }),
      step(4, 'pages.pratique.c4_t', { x: 62, y: 76, r: -2 }),
    ],
  },
  evenements: {
    layout: 'split-left',
    shape: 'squircle',
    photos: [19783489],
    cards: [
      info('calendar', 'hero.next_t', 'hero.next_p', { x: 58, y: 8, r: 2 }),
      stat('events_year', 24, { x: -8, y: 78, r: -3 }),
    ],
  },
  liturgie: {
    layout: 'centered',
    shape: 'circle',
    photos: [18487803],
    giant: 'season',
    cards: [{ kind: 'season', at: { x: 54, y: 84, r: -1 } }],
  },
  moissons: {
    layout: 'split-right',
    shape: 'drop',
    photos: [36937754],
    cards: [
      {
        kind: 'progress',
        label: k('hero.goal_label'),
        value: null,
        example: 64,
        at: { x: -24, y: 52, r: -2 },
      },
      stat('families', 120, { x: 58, y: 8, r: 3 }),
    ],
  },
  nouvelles: {
    layout: 'morph',
    shape: 'squircle',
    photos: [17290990],
    cards: [
      info('newspaper', 'hero.issue_t', 'hero.issue_p', { x: 5, y: 60, r: -2 }),
      info('share', 'hero.share_t', 'hero.share_p', { x: 63, y: 24, r: 2 }),
    ],
  },
  predications: {
    layout: 'centered',
    shape: 'stadium',
    photos: [9056625],
    cards: [
      {
        kind: 'player',
        title: k('hero.player_t'),
        text: k('hero.player_p'),
        at: { x: 18, y: 82, r: -1 },
      },
    ],
  },
  meditations: {
    layout: 'split-left',
    shape: 'arch',
    photos: [10438600],
    cards: [
      info('book', 'hero.weekly_t', 'hero.weekly_p', { x: 54, y: 10, r: 2 }),
      info('download', 'hero.bulletin_t', 'hero.bulletin_p', { x: -16, y: 68, r: -2 }),
    ],
  },
  give: {
    layout: 'split-right',
    shape: 'sail',
    photos: [37088368],
    giant: 'thanks',
    cards: [
      info('phone', 'hero.momo_t', 'hero.number_soon', { x: -22, y: 22, r: -2 }),
      info('money', 'hero.om_t', 'hero.number_soon', { x: 52, y: 80, r: 2 }),
    ],
  },
  privacy: {
    layout: 'plain',
    shape: 'blob',
    photos: [],
    cards: [info('shield', 'hero.privacy_t', 'hero.privacy_p', { x: 0, y: 0 })],
  },
  legal: {
    layout: 'plain',
    shape: 'blob',
    photos: [],
    cards: [info('info', 'hero.legal_t', 'hero.legal_p', { x: 0, y: 0 })],
  },
}
