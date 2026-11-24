/**
 * Share link and prefilled post for a saved base.
 *
 * The link carries a random id, never the wallet the base is saved under, the
 * same rule the forecast share links follow.
 *
 * Pure. No React, no network.
 */
import { isNameAllowed } from '@/lib/touchdown/leaderboard'
import { DEFAULT_BASE_NAME, MAX_NAME_LENGTH, type MoonbaseLayout } from './grid'

export const BASE_ID_LENGTH = 10
// No 0/O or 1/I/l, so an id read aloud or retyped still works.
export const BASE_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const BASE_ID_RE = new RegExp(`^[${BASE_ID_ALPHABET}]{${BASE_ID_LENGTH}}$`)

export const BASE_SHARE_PATH = '/moonbase/base'
export const BASE_SHARE_URL_LABEL = 'moondao.com/moonbase'

export function isBaseId(value: unknown): value is string {
  return typeof value === 'string' && BASE_ID_RE.test(value)
}

/** A base id from `bytes` of randomness, one byte per character. */
export function baseIdFromBytes(bytes: Uint8Array): string {
  let id = ''
  for (let i = 0; i < BASE_ID_LENGTH; i++) {
    id += BASE_ID_ALPHABET[(bytes[i] ?? 0) % BASE_ID_ALPHABET.length]
  }
  return id
}

export function baseSharePath(id: string): string {
  return `${BASE_SHARE_PATH}/${id}`
}

export type BaseShareMethod = 'x' | 'copy' | 'sheet'

export function baseShareUrl(origin: string, id: string, method: BaseShareMethod): string {
  const utm = `utm_source=${method}&utm_medium=social&utm_campaign=moonbase_share`
  return `${origin.replace(/\/+$/, '')}${baseSharePath(id)}?${utm}`
}

/**
 * The name a base is shown under to anyone but its owner. The owner can type
 * anything; a visitor and a link preview get the default in place of a name
 * the leaderboards would refuse.
 */
export function publicBaseName(name: unknown, extraBlocklist = ''): string {
  if (typeof name !== 'string') return DEFAULT_BASE_NAME
  const clean = name
    // Control characters, and the bidi overrides that reorder the text around them.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  if (!clean) return DEFAULT_BASE_NAME
  // The leaderboard check reads Latin letters. A name without any has nothing for it to match.
  if (/[a-z0-9]/i.test(clean) && !isNameAllowed(clean, extraBlocklist)) return DEFAULT_BASE_NAME
  return clean
}

export type BaseCounts = { assets: number; scenery: number; roads: number }

export function baseCounts(layout: MoonbaseLayout): BaseCounts {
  const assets = layout.items.filter((item) => item.kind === 'asset').length
  return { assets, scenery: layout.items.length - assets, roads: layout.roads.length }
}

/** "3 of 11 races predicted", or nothing when no race has been. */
export function racesLine(predicted: number, total: number): string {
  if (predicted <= 0 || total <= 0) return ''
  return `${Math.min(predicted, total)} of ${total} races predicted`
}

/** Prefilled post: what it is, how much of it is predicted, and an invitation. */
export function baseShareText(name: string, predicted: number, total: number): string {
  const shown = publicBaseName(name)
  const lead =
    shown === DEFAULT_BASE_NAME
      ? 'I built a moonbase out of the hardware I predict will win 🌕'
      : `I built a moonbase out of the hardware I predict will win: ${shown} 🌕`
  const races = racesLine(predicted, total)
  return [lead, ...(races ? [`${races}.`] : []), '', 'What would yours look like?'].join('\n')
}
