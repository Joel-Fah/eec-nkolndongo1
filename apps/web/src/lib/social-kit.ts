/**
 * The social media kit: what is drawn (scripts/social-kit.ts) and what the brand guide shows. Sizes follow each platform's
 * current guidance; the *safe* box is where nothing important may be cut by a mobile crop or covered by the profile picture.
 * Check each platform's help page again before a big campaign: they change their sizes now and then.
 */
export type Banner = {
  id: string
  platform: 'Facebook' | 'X' | 'YouTube'
  width: number
  height: number
  /** The centred box (in pixels of the file) that is safe on every screen. */
  safe: { width: number; height: number }
  /** Where the profile picture sits over the banner, as fractions of the file (for the guide's overlay). */
  avatar: { x: number; y: number; size: number } | null
  note: 'fb' | 'x' | 'yt'
  file: string
}
export type Avatar = { id: string; platform: string; size: number; shape: 'circle'; file: string }

export const BANNERS: Banner[] = [
  {
    id: 'facebook-cover',
    platform: 'Facebook',
    width: 1640,
    height: 624,
    safe: { width: 1180, height: 400 },
    avatar: { x: 0.04, y: 0.62, size: 0.3 },
    note: 'fb',
    file: 'facebook-cover.png',
  },
  {
    id: 'x-header',
    platform: 'X',
    width: 1500,
    height: 500,
    safe: { width: 900, height: 280 },
    avatar: { x: 0.03, y: 0.52, size: 0.3 },
    note: 'x',
    file: 'x-header.png',
  },
  {
    id: 'youtube-banner',
    platform: 'YouTube',
    width: 2560,
    height: 1440,
    safe: { width: 1546, height: 423 },
    avatar: null,
    note: 'yt',
    file: 'youtube-banner.png',
  },
]

export const AVATARS: Avatar[] = [
  { id: 'facebook', platform: 'Facebook', size: 720, shape: 'circle', file: 'avatar-facebook' },
  { id: 'x', platform: 'X', size: 400, shape: 'circle', file: 'avatar-x' },
  { id: 'instagram', platform: 'Instagram', size: 320, shape: 'circle', file: 'avatar-instagram' },
  { id: 'youtube', platform: 'YouTube', size: 800, shape: 'circle', file: 'avatar-youtube' },
  { id: 'whatsapp', platform: 'WhatsApp', size: 640, shape: 'circle', file: 'avatar-whatsapp' },
]
/** Each avatar exists in two variants: on cream, and on the parish green (with the halo mark so the outlines stay visible). */
export const AVATAR_VARIANTS = ['light', 'green'] as const
