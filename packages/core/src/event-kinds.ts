/** What kind of event it is: one icon and one colour per kind, so a list can be scanned at a glance. */
export const EVENT_KINDS = [
  'culte',
  'etude',
  'priere',
  'reunion',
  'fete',
  'retraite',
  'sortie',
  'concert',
  'formation',
  'autre',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const EVENT_KIND_STYLE: Record<
  EventKind,
  { icon: string; tone: 'primary' | 'info' | 'gold' | 'clay' | 'success' }
> = {
  culte: { icon: 'church', tone: 'primary' },
  etude: { icon: 'bookText', tone: 'info' },
  priere: { icon: 'prayer', tone: 'success' },
  reunion: { icon: 'users', tone: 'info' },
  fete: { icon: 'party', tone: 'gold' },
  retraite: { icon: 'plant', tone: 'success' },
  sortie: { icon: 'compass', tone: 'clay' },
  concert: { icon: 'music', tone: 'gold' },
  formation: { icon: 'book', tone: 'primary' },
  autre: { icon: 'calendar', tone: 'clay' },
}
export const isEventKind = (v: unknown): v is EventKind =>
  (EVENT_KINDS as readonly unknown[]).includes(v)
