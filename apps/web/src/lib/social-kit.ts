/**
 * The social media kit: what scripts/social-kit.ts draws and what the brand guide shows. Sizes follow each platform's current guidance
 * (check their help pages again before a big campaign). Banners keep the mark in one corner, inside the area every phone shows; profile
 * pictures are square: each platform crops them to its own shape.
 */
export type Banner = {
  id: string
  platform: 'Facebook' | 'X' | 'YouTube'
  width: number
  height: number
  note: 'fb' | 'x' | 'yt'
  file: string
}
export type Avatar = { id: string; platform: string; size: number; file: string }

export const BANNERS: Banner[] = [
  {
    id: 'facebook-cover',
    platform: 'Facebook',
    width: 1640,
    height: 624,
    note: 'fb',
    file: 'facebook-cover.png',
  },
  { id: 'x-header', platform: 'X', width: 1500, height: 500, note: 'x', file: 'x-header.png' },
  {
    id: 'youtube-banner',
    platform: 'YouTube',
    width: 2560,
    height: 1440,
    note: 'yt',
    file: 'youtube-banner.png',
  },
]
export const AVATARS: Avatar[] = [
  { id: 'facebook', platform: 'Facebook', size: 720, file: 'avatar-facebook' },
  { id: 'x', platform: 'X', size: 400, file: 'avatar-x' },
  { id: 'instagram', platform: 'Instagram', size: 320, file: 'avatar-instagram' },
  { id: 'youtube', platform: 'YouTube', size: 800, file: 'avatar-youtube' },
  { id: 'whatsapp', platform: 'WhatsApp', size: 640, file: 'avatar-whatsapp' },
]
/** `art`: the ribbons of light with the mark; `light`: the mark alone on cream. */
export const AVATAR_VARIANTS = ['art', 'light'] as const
