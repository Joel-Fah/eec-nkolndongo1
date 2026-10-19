import art from '@eec/ui/illustrations/hymn-book-handover.svg?raw'

/** The hymn-book illustration (decorative), coloured by tokens. */
export function Illustration() {
  return (
    <span
      aria-hidden="true"
      className="block w-full"
      dangerouslySetInnerHTML={{
        __html: art.replace('<svg ', '<svg style="width:100%;height:auto" aria-hidden="true" '),
      }}
    />
  )
}
