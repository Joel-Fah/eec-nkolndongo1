import { m } from '@eec/i18n/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main>
      <h1>{m['site.name']()}</h1>
    </main>
  )
}
