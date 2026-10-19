/** U+202F narrow no-break space — before `; ! ?` in French. */
export const NNBSP = ' '
/** U+00A0 no-break space — before `:` and inside « guillemets ». */
export const NBSP = ' '

const SPACES = '[ \\u00A0\\u202F]*'
// A punctuation mark preceded by a "real" character and followed by a space, a closing mark or the end.
// This leaves URLs (`https://`, `?q=`) and times (`09:00`) untouched.
const HIGH_PUNCT = new RegExp(`([^\\s;:!?«])${SPACES}([;!?]+)(?=[\\s»)\\]]|$)`, 'gu')
const COLON = new RegExp(`([^\\s;:!?«])${SPACES}:(?=[\\s»)\\]]|$)`, 'gu')

/**
 * French typography for plain strings: correct no-break spaces before `: ; ! ?`,
 * inside « guillemets », and curly apostrophes.
 */
export function frTypo(input: string): string {
  return input
    .replace(/(\p{L})'(?=\p{L})/gu, '$1’')
    .replace(/«[   ]*/g, `«${NBSP}`)
    .replace(/[   ]*»/g, `${NBSP}»`)
    .replace(HIGH_PUNCT, `$1${NNBSP}$2`)
    .replace(COLON, `$1${NBSP}:`)
}
