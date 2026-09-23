import { CITIZENSHIP_GIFT_TAG, DEPLOYED_ORIGIN } from 'const/config'
import { truncateTokenValue } from '@/lib/utils/numbers'
import type { TeamListing } from '@/components/subscription/TeamListing'
import { NON_CITIZEN_MARKUP, parseListingPrice } from './usdcListingPurchase'

/**
 * Presentation helpers for a marketplace listing, shared by the grid cards and
 * the dedicated listing page so both agree on price, availability and links.
 */

export type ListingStatus = 'live' | 'upcoming' | 'ended'

export type ListingAvailability = {
  status: ListingStatus
  /** Short badge label, e.g. "Available now" or "Ends in 3 days". */
  label: string
  isPurchasable: boolean
}

export function getListingHref(listing: Pick<TeamListing, 'id'>): string {
  return `/marketplace/${listing.id}`
}

export function getListingShareUrl(listing: Pick<TeamListing, 'id'>): string {
  return `${DEPLOYED_ORIGIN}${getListingHref(listing)}`
}

export function isGiftListing(listing: Pick<TeamListing, 'tag'>): boolean {
  return listing.tag === CITIZENSHIP_GIFT_TAG
}

export function requiresShipping(listing: Pick<TeamListing, 'shipping'>): boolean {
  return listing.shipping === 'true'
}

function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.ceil((to - from) / 86400))
}

/**
 * A listing is timed by `startTime`/`endTime`, where 0 means "unbounded". Mirrors
 * the active/upcoming/expired logic the cards already apply.
 */
export function getListingAvailability(
  listing: Pick<TeamListing, 'startTime' | 'endTime'>,
  now = Math.floor(Date.now() / 1000),
): ListingAvailability {
  const startTime = listing.startTime || 0
  const endTime = listing.endTime || 0

  if (startTime > 0 && now < startTime) {
    return {
      status: 'upcoming',
      label: `Available ${new Date(startTime * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
      isPurchasable: false,
    }
  }

  if (endTime > 0 && now > endTime) {
    return { status: 'ended', label: 'No longer available', isPurchasable: false }
  }

  if (endTime > 0) {
    const days = daysBetween(now, endTime)
    return {
      status: 'live',
      label: days === 0 ? 'Ends today' : `Ends in ${days} ${days === 1 ? 'day' : 'days'}`,
      isPurchasable: true,
    }
  }

  return { status: 'live', label: 'Available now', isPurchasable: true }
}

export type ListingPriceDisplay = {
  /** What this viewer pays. */
  display: string
  /** Undiscounted price, shown struck through to citizens. */
  full: string
  /** Amount a non-citizen would save by becoming one. */
  savings: string
  isFree: boolean
}

/**
 * Non-citizens pay a 10% markup; gifted citizenships are always flat price.
 * Matches `computePurchasePrice` so the page never quotes a different number
 * than the buy modal charges.
 */
export function formatListingPrice(
  listing: Pick<TeamListing, 'price' | 'currency' | 'tag'>,
  isCitizen: boolean,
): ListingPriceDisplay {
  const numericPrice = parseListingPrice(listing.price)
  const currency = listing.currency || ''

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return { display: 'Free', full: 'Free', savings: '', isFree: true }
  }

  const flat = `${truncateTokenValue(numericPrice, currency)} ${currency}`.trim()
  const marked =
    `${truncateTokenValue(numericPrice * NON_CITIZEN_MARKUP, currency)} ${currency}`.trim()
  const savings = `${truncateTokenValue(
    numericPrice * (NON_CITIZEN_MARKUP - 1),
    currency,
  )} ${currency}`.trim()

  // A gifted citizenship has no citizen/non-citizen split.
  if (isGiftListing(listing)) {
    return { display: flat, full: flat, savings: '', isFree: false }
  }

  return {
    display: isCitizen ? flat : marked,
    full: marked,
    savings,
    isFree: false,
  }
}

export function formatListingDate(timestamp?: number): string | null {
  if (!timestamp || timestamp <= 0) return null
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
