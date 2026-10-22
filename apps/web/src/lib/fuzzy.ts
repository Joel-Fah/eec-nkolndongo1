/** Accent- and case-insensitive text matching that forgives a typo, shared by the search page and the header dialog. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Edit distance up to `max` (small words only). */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    prev = cur
  }
  return (prev[b.length] ?? 99) <= max
}

/** True when the (folded) word is in the text, or one of its words is a typo away (one edit; two for long words). */
export function fuzzyHas(text: string, word: string): boolean {
  const hay = fold(text)
  if (hay.includes(word)) return true
  if (word.length < 4) return false
  const max = word.length >= 7 ? 2 : 1
  return hay.split(/[^a-z0-9]+/).some((w) => w.length >= 3 && within(word, w, max))
}

/** Every searched word (2+ letters) must be found, typos forgiven. */
export function matchesAll(text: string, query: string): boolean {
  const words = fold(query)
    .split(' ')
    .filter((w) => w.length >= 2)
  return words.length > 0 && words.every((w) => fuzzyHas(text, w))
}
