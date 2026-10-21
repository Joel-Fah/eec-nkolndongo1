/**
 * Page content manifest: every public page is a hero + typed blocks, all text through packages/i18n.
 * Keys are typed (MessageKey): a missing key fails typecheck.
 */
import type { MessageKey as K } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'

export type Block =
  | { t: 'text'; title?: K; paras: K[] }
  | { t: 'list'; title?: K; intro?: K; items: K[] }
  | { t: 'cards'; title?: K; cols?: 2 | 3 | 4; cards: { icon: IconName; title: K; text: K }[] }
  | { t: 'verse'; text: K; cite: K }
  | { t: 'empty'; title: K; text: K; link?: { page: string; label: K } }
  | { t: 'seasons'; title: K; footnote: K }
  | { t: 'note'; text: K }
  | { t: 'credits'; title: K; empty: K }

export type PageContent = { lead: K; art?: string; blocks: Block[] }

const p = (key: string) => `pages.${key}` as K

export const content: Record<string, PageContent> = {
  histoire: {
    lead: p('histoire.lead'),
    art: 'church',
    blocks: [
      { t: 'text', title: p('histoire.s1_t'), paras: [p('histoire.s1_p1'), p('histoire.s1_p2')] },
      { t: 'text', title: p('histoire.s2_t'), paras: [p('histoire.s2_p')] },
    ],
  },
  croyances: {
    lead: p('croyances.lead'),
    art: 'church',
    blocks: [
      { t: 'text', title: p('croyances.s1_t'), paras: [p('croyances.s1_p')] },
      { t: 'verse', text: p('croyances.creed'), cite: p('croyances.creed_cite') },
      {
        t: 'cards',
        title: p('croyances.s2_t'),
        cols: 4,
        cards: [
          { icon: 'bible', title: p('croyances.c1_t'), text: p('croyances.c1_p') },
          { icon: 'gift', title: p('croyances.c2_t'), text: p('croyances.c2_p') },
          { icon: 'prayer', title: p('croyances.c3_t'), text: p('croyances.c3_p') },
          { icon: 'users', title: p('croyances.c4_t'), text: p('croyances.c4_p') },
        ],
      },
      { t: 'note', text: p('croyances.note') },
    ],
  },
  pasteurs: {
    lead: p('pasteurs.lead'),
    art: 'church',
    blocks: [
      { t: 'text', title: p('pasteurs.s1_t'), paras: [p('pasteurs.s1_p')] },
      {
        t: 'cards',
        cols: 3,
        cards: [
          { icon: 'prayer', title: p('pasteurs.r1_t'), text: p('pasteurs.r1_p') },
          { icon: 'account', title: p('pasteurs.r2_t'), text: p('pasteurs.r2_p') },
          { icon: 'heart', title: p('pasteurs.r3_t'), text: p('pasteurs.r3_p') },
          { icon: 'book', title: p('pasteurs.r4_t'), text: p('pasteurs.r4_p') },
          { icon: 'users', title: p('pasteurs.r5_t'), text: p('pasteurs.r5_p') },
        ],
      },
      { t: 'text', title: p('pasteurs.s3_t'), paras: [p('pasteurs.s3_p')] },
    ],
  },
  trouver: {
    lead: p('trouver.lead'),
    art: 'church',
    blocks: [
      { t: 'text', title: p('trouver.s1_t'), paras: [p('trouver.s1_p')] },
      {
        t: 'list',
        title: p('trouver.s2_t'),
        items: [p('trouver.l1'), p('trouver.l2'), p('trouver.l3'), p('trouver.l4')],
      },
    ],
  },
  cultes: {
    lead: p('cultes.lead'),
    art: 'community',
    blocks: [
      {
        t: 'list',
        title: p('cultes.s1_t'),
        intro: p('cultes.s1_p'),
        items: [p('cultes.l1'), p('cultes.l2'), p('cultes.l3'), p('cultes.l4'), p('cultes.l5')],
      },
      { t: 'text', title: p('cultes.s2_t'), paras: [p('cultes.s2_p')] },
    ],
  },
  departements: {
    lead: p('departements.lead'),
    art: 'community',
    blocks: [
      {
        t: 'cards',
        title: p('departements.s1_t'),
        cols: 2,
        cards: [
          { icon: 'music', title: p('departements.g1_t'), text: p('departements.g1_p') },
          { icon: 'users', title: p('departements.g2_t'), text: p('departements.g2_p') },
          { icon: 'heart', title: p('departements.g3_t'), text: p('departements.g3_p') },
          { icon: 'book', title: p('departements.g4_t'), text: p('departements.g4_p') },
        ],
      },
      { t: 'text', title: p('departements.s2_t'), paras: [p('departements.s2_p')] },
    ],
  },
  pratique: {
    lead: p('pratique.lead'),
    art: 'community',
    blocks: [
      {
        t: 'cards',
        cols: 2,
        cards: [
          { icon: 'heart', title: p('pratique.c1_t'), text: p('pratique.c1_p') },
          { icon: 'users', title: p('pratique.c2_t'), text: p('pratique.c2_p') },
          { icon: 'prayer', title: p('pratique.c3_t'), text: p('pratique.c3_p') },
          { icon: 'home', title: p('pratique.c4_t'), text: p('pratique.c4_p') },
        ],
      },
      { t: 'note', text: p('pratique.note') },
    ],
  },
  evenements: {
    lead: p('evenements.lead'),
    art: 'events',
    blocks: [
      {
        t: 'empty',
        title: p('evenements.empty_t'),
        text: p('evenements.empty_p'),
        link: { page: 'liturgie', label: p('evenements.link') },
      },
    ],
  },
  liturgie: {
    lead: p('liturgie.lead'),
    art: 'events',
    blocks: [{ t: 'seasons', title: p('liturgie.s1_t'), footnote: p('liturgie.s2_p') }],
  },
  moissons: {
    lead: p('moissons.lead'),
    art: 'events',
    blocks: [
      { t: 'text', title: p('moissons.s1_t'), paras: [p('moissons.s1_p1'), p('moissons.s1_p2')] },
    ],
  },
  nouvelles: {
    lead: p('nouvelles.lead'),
    art: 'news',
    blocks: [{ t: 'empty', title: p('nouvelles.empty_t'), text: p('nouvelles.empty_p') }],
  },
  predications: {
    lead: p('predications.lead'),
    art: 'news',
    blocks: [{ t: 'empty', title: p('predications.empty_t'), text: p('predications.empty_p') }],
  },
  meditations: {
    lead: p('meditations.lead'),
    art: 'news',
    blocks: [{ t: 'empty', title: p('meditations.empty_t'), text: p('meditations.empty_p') }],
  },
  give: {
    lead: p('give.lead'),
    art: 'reading-book',
    blocks: [
      { t: 'text', title: p('give.s1_t'), paras: [p('give.s1_p')] },
      { t: 'text', title: p('give.s2_t'), paras: [p('give.s2_p')] },
      { t: 'text', title: p('give.s3_t'), paras: [p('give.s3_p')] },
    ],
  },
  account: {
    lead: p('account.lead'),
    blocks: [
      {
        t: 'list',
        title: p('account.s1_t'),
        items: [p('account.l1'), p('account.l2'), p('account.l3'), p('account.l4')],
      },
      { t: 'text', title: p('account.s2_t'), paras: [p('account.s2_p')] },
    ],
  },
  privacy: {
    lead: p('privacy.lead'),
    blocks: [
      { t: 'text', title: p('privacy.s1_t'), paras: [p('privacy.s1_p')] },
      { t: 'text', title: p('privacy.s2_t'), paras: [p('privacy.s2_p')] },
      {
        t: 'list',
        title: p('privacy.s3_t'),
        items: [
          p('privacy.l1'),
          p('privacy.l2'),
          p('privacy.l3'),
          p('privacy.l4'),
          p('privacy.l5'),
        ],
      },
      { t: 'text', title: p('privacy.s4_t'), paras: [p('privacy.s4_p')] },
      {
        t: 'list',
        title: p('privacy.s5_t'),
        items: [p('privacy.l6'), p('privacy.l7'), p('privacy.l8')],
      },
      {
        t: 'list',
        title: p('privacy.s6_t'),
        items: [p('privacy.l9'), p('privacy.l10'), p('privacy.l11')],
      },
      { t: 'text', title: p('privacy.s7_t'), paras: [p('privacy.s7_p')] },
      { t: 'text', title: p('privacy.s8_t'), paras: [p('privacy.s8_p')] },
      { t: 'text', title: p('privacy.s9_t'), paras: [p('privacy.s9_p')] },
      { t: 'text', title: p('privacy.s10_t'), paras: [p('privacy.s10_p')] },
    ],
  },
  credits: {
    lead: p('credits.lead'),
    blocks: [
      { t: 'text', title: p('credits.s1_t'), paras: [p('credits.s1_p')] },
      { t: 'credits', title: p('credits.s2_t'), empty: p('credits.empty') },
    ],
  },
  legal: {
    lead: p('legal.lead'),
    blocks: [
      { t: 'text', title: p('legal.s1_t'), paras: [p('legal.s1_p')] },
      { t: 'text', title: p('legal.s2_t'), paras: [p('legal.s2_p')] },
      { t: 'text', title: p('legal.s3_t'), paras: [p('legal.s3_p')] },
      { t: 'text', title: p('legal.s4_t'), paras: [p('legal.s4_p')] },
    ],
  },
}
