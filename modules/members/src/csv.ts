/** One CSV cell: always quoted, and defused when a spreadsheet would run it as a formula. */
export const csvCell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
  // A cell starting with = + - @ would be run as a formula by a spreadsheet: defuse it.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replaceAll('"', '""')}"`
}
