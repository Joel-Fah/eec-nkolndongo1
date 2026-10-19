/**
 * Page heroes: one layout per page, each different (Joël, 2026-10-19). Near full-screen photos, cards laid
 * over them. Photos are dev-only placeholders for now (lib/placeholders.ts): without them every layout
 * falls back to a tinted, textured panel, so production never shows a broken image.
 * Figures are facts: `value` stays null until validated; in dev the `example` is shown, tagged « exemple ».
 */
import type { MessageKey as K } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'

export type HeroLayout =
  | 'fullbleed'
  | 'arch'
  | 'stack'
  | 'panorama'
  | 'split'
  | 'mosaic'
  | 'path'
  | 'ticket'
  | 'duotone'
  | 'goal'
  | 'cover'
  | 'listen'
  | 'reading'
  | 'gratitude'
  | 'plain'
export type HeroCard =
  | { kind: 'stat'; label: K; value: number | null; example: number; suffix?: string }
  | { kind: 'info'; icon: IconName; title: K; text: K }
  /** The liturgical year strip, in a card. */
  | { kind: 'season' }
  /** A progress ring toward a goal (a fact: null until validated). */
  | { kind: 'progress'; label: K; value: number | null; example: number }
  /** A (not yet working) audio player, for the listening room. */
  | { kind: 'player'; title: K; text: K }
export type Hero = { layout: HeroLayout; photos: number[]; cards: HeroCard[] }

const k = (key: string) => key as K
const stat = (label: string, example: number, suffix?: string): HeroCard => ({
  kind: 'stat',
  label: k(`hero.stats.${label}`),
  value: null,
  example,
  suffix,
})
const info = (icon: IconName, title: string, text: string): HeroCard => ({
  kind: 'info',
  icon,
  title: k(title),
  text: k(text),
})

export const heroes: Record<string, Hero> = {
  histoire: {
    layout: 'fullbleed',
    photos: [17290989],
    cards: [stat('years', 60, '+'), stat('pastors', 12), stat('generations', 3)],
  },
  croyances: {
    layout: 'arch',
    photos: [15382617],
    cards: [
      info('bible', 'pages.croyances.c1_t', 'pages.croyances.c1_p'),
      info('gift', 'pages.croyances.c2_t', 'pages.croyances.c2_p'),
    ],
  },
  pasteurs: {
    layout: 'stack',
    photos: [9056625, 8270597, 30356540, 35388499],
    cards: [stat('pastors_now', 2), stat('council', 12)],
  },
  trouver: {
    layout: 'panorama',
    photos: [31326469],
    cards: [
      info('location', 'footer.visit', 'footer.address'),
      info('clock', 'footer.hours_title', 'footer.hours'),
    ],
  },
  cultes: {
    layout: 'split',
    photos: [8270597],
    cards: [
      stat('services_week', 3),
      stat('minutes', 150),
      info('users', 'hero.cultes_all_t', 'hero.cultes_all_p'),
    ],
  },
  departements: {
    layout: 'mosaic',
    photos: [32037766, 28181212, 7520351],
    cards: [stat('groups', 12), stat('ages', 5)],
  },
  pratique: {
    layout: 'path',
    photos: [32632180],
    cards: [
      info('plant', 'pages.pratique.c1_t', 'hero.path_step'),
      info('heart', 'pages.pratique.c2_t', 'hero.path_step'),
      info('prayer', 'pages.pratique.c3_t', 'hero.path_step'),
      info('users', 'pages.pratique.c4_t', 'hero.path_step'),
    ],
  },
  evenements: {
    layout: 'ticket',
    photos: [19783489],
    cards: [info('calendar', 'hero.next_t', 'hero.next_p'), stat('events_year', 24)],
  },
  liturgie: {
    layout: 'duotone',
    photos: [18487803],
    cards: [{ kind: 'season' }],
  },
  moissons: {
    layout: 'goal',
    photos: [36937754],
    cards: [
      { kind: 'progress', label: k('hero.goal_label'), value: null, example: 64 },
      stat('families', 120),
    ],
  },
  nouvelles: {
    layout: 'cover',
    photos: [17290990],
    cards: [
      info('newspaper', 'hero.issue_t', 'hero.issue_p'),
      info('share', 'hero.share_t', 'hero.share_p'),
    ],
  },
  predications: {
    layout: 'listen',
    photos: [9056625],
    cards: [{ kind: 'player', title: k('hero.player_t'), text: k('hero.player_p') }],
  },
  meditations: {
    layout: 'reading',
    photos: [10438600],
    cards: [
      info('book', 'hero.weekly_t', 'hero.weekly_p'),
      info('download', 'hero.bulletin_t', 'hero.bulletin_p'),
    ],
  },
  give: {
    layout: 'gratitude',
    photos: [37088368],
    cards: [
      info('phone', 'hero.momo_t', 'hero.number_soon'),
      info('money', 'hero.om_t', 'hero.number_soon'),
    ],
  },
  privacy: {
    layout: 'plain',
    photos: [],
    cards: [info('shield', 'hero.privacy_t', 'hero.privacy_p')],
  },
  legal: { layout: 'plain', photos: [], cards: [info('info', 'hero.legal_t', 'hero.legal_p')] },
}
