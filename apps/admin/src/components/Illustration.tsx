/** A Storyset illustration (decision 0024): light and dark files from /admin/illustrations/, decorative. */
export function Illustration({
  name = 'reading-book',
  dark,
}: {
  name?: string
  /** A different drawing for dark mode (both kept in their own colours). */
  dark?: string
}) {
  const base = `${import.meta.env.BASE_URL}illustrations/${name}`
  const darkBase = `${import.meta.env.BASE_URL}illustrations/${dark ?? name}`
  return (
    <span className="illo" aria-hidden="true">
      <img
        className="illo-light"
        src={`${base}-light.svg`}
        alt=""
        width={500}
        height={500}
        loading="lazy"
      />
      <img
        className="illo-dark"
        src={`${darkBase}-dark.svg`}
        alt=""
        width={500}
        height={500}
        loading="lazy"
      />
    </span>
  )
}
