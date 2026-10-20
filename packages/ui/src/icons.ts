/**
 * The icons we use, by meaning. Hugeicons free set — stroke-rounded only (decision 0011).
 * Add an icon here before using it, so the set stays small and consistent.
 */
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Book02Icon,
  BookOpen01Icon,
  BubbleChatIcon,
  Calendar03Icon,
  Call02Icon,
  Cancel01Icon,
  CheckListIcon,
  ChurchIcon,
  Clock01Icon,
  Coins01Icon,
  CommandIcon,
  CompassIcon,
  ComputerIcon,
  Download04Icon,
  FavouriteIcon,
  GiftIcon,
  Globe02Icon,
  HandPrayerIcon,
  HeadphonesIcon,
  Home03Icon,
  HourglassIcon,
  InformationCircleIcon,
  Loading03Icon,
  Location01Icon,
  Logout01Icon,
  Mail01Icon,
  Menu02Icon,
  MinusSignIcon,
  Moon02Icon,
  MusicNote03Icon,
  NewspaperIcon,
  PauseIcon,
  PlantIcon,
  PlayIcon,
  PlusSignIcon,
  Refresh01Icon,
  Search01Icon,
  SecurityCheckIcon,
  Settings02Icon,
  Share08Icon,
  SquareLock02Icon,
  Sun03Icon,
  Tick02Icon,
  UserCircleIcon,
  UserGroupIcon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons'

export type IconData = readonly (readonly [string, Readonly<Record<string, string | number>>])[]

export const icons = {
  home: Home03Icon,
  calendar: Calendar03Icon,
  church: ChurchIcon,
  bible: Book02Icon,
  book: BookOpen01Icon,
  music: MusicNote03Icon,
  users: UserGroupIcon,
  heart: FavouriteIcon,
  prayer: HandPrayerIcon,
  phone: Call02Icon,
  location: Location01Icon,
  mail: Mail01Icon,
  search: Search01Icon,
  language: Globe02Icon,
  sun: Sun03Icon,
  moon: Moon02Icon,
  system: ComputerIcon,
  menu: Menu02Icon,
  close: Cancel01Icon,
  arrowRight: ArrowRight01Icon,
  arrowLeft: ArrowLeft01Icon,
  chevronDown: ArrowDown01Icon,
  external: ArrowUpRight01Icon,
  play: PlayIcon,
  pause: PauseIcon,
  lock: SquareLock02Icon,
  shield: SecurityCheckIcon,
  download: Download04Icon,
  share: Share08Icon,
  chat: BubbleChatIcon,
  whatsapp: WhatsappIcon,
  gift: GiftIcon,
  money: Coins01Icon,
  info: InformationCircleIcon,
  check: Tick02Icon,
  alert: Alert02Icon,
  clock: Clock01Icon,
  account: UserCircleIcon,
  settings: Settings02Icon,
  logout: Logout01Icon,
  command: CommandIcon,
  plus: PlusSignIcon,
  minus: MinusSignIcon,
  loading: Loading03Icon,
  compass: CompassIcon,
  newspaper: NewspaperIcon,
  headphones: HeadphonesIcon,
  plant: PlantIcon,
  hourglass: HourglassIcon,
  refresh: Refresh01Icon,
  checklist: CheckListIcon,
} satisfies Record<string, IconData>

export type IconName = keyof typeof icons

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Renders an icon to an SVG string (used by the Astro `<Icon>` at build time — zero JS).
 * Decorative unless a `label` is given.
 */
export function iconSvg(
  name: IconName,
  { size = 20, label, className }: { size?: 16 | 20 | 24; label?: string; className?: string } = {},
): string {
  const children = (icons[name] as IconData)
    .map(([tag, attrs]) => {
      const rendered = Object.entries(attrs)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${kebab(key)}="${escapeAttr(String(value))}"`)
        .join(' ')
      return `<${tag} ${rendered}/>`
    })
    .join('')
  const a11y = label ? `role="img" aria-label="${escapeAttr(label)}"` : 'aria-hidden="true"'
  const cls = className ? ` class="${escapeAttr(className)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" focusable="false" ${a11y}${cls}>${children}</svg>`
}
