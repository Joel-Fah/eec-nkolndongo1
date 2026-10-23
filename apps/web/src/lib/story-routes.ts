/** What /api/story/public returns (see modules/story). Photos are media objects for <Picture>. */
export type StoryData = {
  slots: Record<string, Record<string, { text: string; html: string }>>
  milestones: {
    id: string
    year: string
    title: string
    text: string
    image: unknown | null
    images: unknown[]
    layout: string
  }[]
  council: {
    key: string
    label: string
    people: { name: string | null; title: string; term: string; photo: unknown | null }[]
  }[]
}
