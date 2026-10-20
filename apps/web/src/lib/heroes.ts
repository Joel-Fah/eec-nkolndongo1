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

/**
 * stage: centered text on top, a row of shapes below that runs partly off the first screen (1 shape on
 * phones, 2 on tablets, 3 on laptops, 4 on large displays) · morph: a full-screen photo (behind the navbar)
 * that settles into a framed rectangle as you scroll · plain: no photo.
 */
export type HeroLayout = 'stage' | 'morph' | 'plain'

/**
 * Where a card sits, in % of the row of shapes (of the viewport for `morph`). x may be negative or past 100
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
  /** One shape per tile (the row shows as many as fit the screen: 1 → 4). */
  shapes: ShapeId[]
  /** One photo per tile; `morph` heroes use the first. */
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
    shapes: ['squircle'],
    photos: [17290989],
    cards: [
      stat('years', 60, { x: 6, y: 56, r: -3 }, '+'),
      stat('pastors', 12, { x: 72, y: 24, r: 3 }),
      stat('generations', 3, { x: 62, y: 72, r: -2 }),
    ],
  },
  croyances: {
    layout: 'stage',
    shapes: ['windows', 'blob', 'arch', 'leaf'],
    photos: [15382617, 10438600, 9056625, 18487803],
    cards: [
      info('bible', 'pages.croyances.c1_t', 'pages.croyances.c1_p', { x: 4, y: 52, r: -2 }),
      info('gift', 'pages.croyances.c2_t', 'pages.croyances.c2_p', { x: 58, y: 70, r: 2 }),
    ],
  },
  pasteurs: {
    layout: 'stage',
    shapes: ['blocks', 'flower', 'squircle', 'drop'],
    photos: [30356540, 35388499, 7520351, 28181212],
    cards: [
      stat('pastors_now', 2, { x: 30, y: 12, r: 3 }),
      stat('council', 12, { x: 74, y: 76, r: -3 }),
    ],
  },
  trouver: {
    layout: 'morph',
    shapes: ['squircle'],
    photos: [31326469],
    cards: [
      info('location', 'footer.visit', 'footer.address', { x: 6, y: 62, r: -2 }),
      info('clock', 'footer.hours_title', 'footer.hours', { x: 62, y: 70, r: 2 }),
    ],
  },
  cultes: {
    layout: 'stage',
    shapes: ['blob', 'arch', 'flower', 'sail'],
    photos: [8270597, 7520351, 9056625, 28181212],
    cards: [
      stat('services_week', 3, { x: 6, y: 18, r: -3 }),
      stat('minutes', 150, { x: 52, y: 58, r: 3 }),
      info('users', 'hero.cultes_all_t', 'hero.cultes_all_p', { x: 76, y: 90, r: -1 }),
    ],
  },
  departements: {
    layout: 'stage',
    shapes: ['flower', 'blocks', 'drop', 'squircle'],
    photos: [32037766, 19783489, 28181212, 32037767],
    cards: [stat('groups', 12, { x: 40, y: 10, r: 3 }), stat('ages', 5, { x: 8, y: 80, r: -3 })],
  },
  pratique: {
    layout: 'stage',
    shapes: ['leaf', 'drop', 'arch', 'blob'],
    photos: [32632180, 10438600, 19783489, 17290990],
    cards: [
      step(1, 'pages.pratique.c1_t', { x: 4, y: 14, r: -2 }),
      step(2, 'pages.pratique.c2_t', { x: 30, y: 62, r: 2 }),
      step(3, 'pages.pratique.c3_t', { x: 58, y: 18, r: 2 }),
      step(4, 'pages.pratique.c4_t', { x: 80, y: 70, r: -2 }),
    ],
  },
  evenements: {
    layout: 'stage',
    shapes: ['squircle', 'blob', 'flower', 'blocks'],
    photos: [19783489, 32037767, 28181212, 7520351],
    cards: [
      info('calendar', 'hero.next_t', 'hero.next_p', { x: 34, y: 12, r: 2 }),
      stat('events_year', 24, { x: 70, y: 74, r: -3 }),
    ],
  },
  liturgie: {
    layout: 'stage',
    shapes: ['circle', 'windows', 'flower', 'arch'],
    photos: [18487803, 9056625, 15382617, 10438600],
    giant: 'season',
    cards: [{ kind: 'season', at: { x: 28, y: 68, r: -1 } }],
  },
  moissons: {
    layout: 'stage',
    shapes: ['drop', 'blob', 'leaf', 'squircle'],
    photos: [36937754, 37088368, 17290989, 31326469],
    cards: [
      {
        kind: 'progress',
        label: k('hero.goal_label'),
        value: null,
        example: 64,
        at: { x: 6, y: 58, r: -2 },
      },
      stat('families', 120, { x: 66, y: 16, r: 3 }),
    ],
  },
  nouvelles: {
    layout: 'morph',
    shapes: ['squircle'],
    photos: [17290990],
    cards: [
      info('newspaper', 'hero.issue_t', 'hero.issue_p', { x: 6, y: 60, r: -2 }),
      info('share', 'hero.share_t', 'hero.share_p', { x: 64, y: 26, r: 2 }),
    ],
  },
  predications: {
    layout: 'stage',
    shapes: ['stadium', 'arch', 'blob', 'drop'],
    photos: [9056625, 8270597, 18487803, 10438600],
    cards: [
      {
        kind: 'player',
        title: k('hero.player_t'),
        text: k('hero.player_p'),
        at: { x: 14, y: 70, r: -1 },
      },
    ],
  },
  meditations: {
    layout: 'stage',
    shapes: ['arch', 'leaf', 'squircle', 'windows'],
    photos: [10438600, 15382617, 9056625, 18487803],
    cards: [
      info('book', 'hero.weekly_t', 'hero.weekly_p', { x: 36, y: 14, r: 2 }),
      info('download', 'hero.bulletin_t', 'hero.bulletin_p', { x: 6, y: 74, r: -2 }),
    ],
  },
  give: {
    layout: 'stage',
    shapes: ['sail', 'drop', 'blob', 'flower'],
    photos: [37088368, 36937754, 19783489, 133699],
    giant: 'thanks',
    cards: [
      info('phone', 'hero.momo_t', 'hero.number_soon', { x: 8, y: 24, r: -2 }),
      info('money', 'hero.om_t', 'hero.number_soon', { x: 62, y: 66, r: 2 }),
    ],
  },
  privacy: {
    layout: 'plain',
    shapes: ['blob'],
    photos: [],
    cards: [info('shield', 'hero.privacy_t', 'hero.privacy_p', { x: 0, y: 0 })],
  },
  legal: {
    layout: 'plain',
    shapes: ['blob'],
    photos: [],
    cards: [info('info', 'hero.legal_t', 'hero.legal_p', { x: 0, y: 0 })],
  },
}
