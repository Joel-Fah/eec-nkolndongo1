/** The arithmetic of a campaign, pure: phase by date, percent, days left, XAF text, the basket's fill, the share card. */
export type Phase = 'before' | 'during' | 'after'
const DAY = 86_400_000
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)

export const phaseOf = (startsOn: string, endsOn: string, today: string): Phase =>
  today < startsOn ? 'before' : today > endsOn ? 'after' : 'during'
/** Is the campaign's page to be shown? From two weeks before it starts to a week after it ends (decision 0042). */
export function inSeason(
  startsOn: string,
  endsOn: string,
  today: string,
  lead = 14,
  grace = 7,
): boolean {
  const day = (d: string, n: number) =>
    new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)
  return today >= day(startsOn, -lead) && today <= day(endsOn, grace)
}
/** Whole days left including the last day (0 once it is over); before the start, days until it begins are `daysUntil`. */
export const daysLeft = (endsOn: string, today: string) =>
  Math.max(Math.round((ms(endsOn) - ms(today)) / DAY) + 1, 0)
export const daysUntil = (startsOn: string, today: string) =>
  Math.max(Math.round((ms(startsOn) - ms(today)) / DAY), 0)
/** 0–100, one decimal never shown: whole percent, capped for the drawing but not for the words (a goal can be passed). */
export const percentOf = (raised: number, goal: number) =>
  goal > 0 ? Math.floor((raised / goal) * 100) : 0
export const fillOf = (raised: number, goal: number) =>
  Math.min(Math.max(percentOf(raised, goal), 0), 100)

/** « 5 000 FCFA » (French thin grouping, in both languages: it is the local convention). */
export const xaf = (n: number) =>
  `${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`

/** An amount a person may enter: a whole number of francs, 1 to 500 million. */
export const amountOk = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 500_000_000

/** Who may validate an entry: not the person who entered it, unless they are the super admin. */
export const mayValidate = (actorId: string, enteredBy: string | null, superAdmin: boolean) =>
  superAdmin || enteredBy === null || enteredBy !== actorId

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
/** The share card (1200×630) as SVG text: title, amount, a bar, days left. Drawn on the server, no image service. */
export function shareCardSvg(o: {
  title: string
  raised: number
  goal: number
  percent: number
  line: string
  church: string
}): string {
  const w = 1200
  const bar = Math.round((w - 160) * (fillOf(o.raised, o.goal) / 100))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${esc(`${o.title}: ${xaf(o.raised)} / ${xaf(o.goal)}`)}">
<rect width="1200" height="630" fill="#FFFDF8"/>
<rect x="0" y="0" width="1200" height="14" fill="#1E5B3A"/>
<text x="80" y="110" font-family="Georgia, serif" font-size="30" fill="#5A6A62">${esc(o.church)}</text>
<text x="80" y="210" font-family="Georgia, serif" font-size="68" font-weight="700" fill="#22302A">${esc(o.title)}</text>
<text x="80" y="340" font-family="Georgia, serif" font-size="96" font-weight="700" fill="#1E5B3A">${esc(xaf(o.raised))}</text>
<text x="80" y="395" font-family="Arial, sans-serif" font-size="32" fill="#3A4A42">${esc(o.line)}</text>
<rect x="80" y="450" width="${w - 160}" height="34" rx="17" fill="#EFEAE0"/>
<rect x="80" y="450" width="${bar}" height="34" rx="17" fill="#E8B931"/>
<text x="80" y="548" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#22302A">${o.percent} %</text>
</svg>`
}
