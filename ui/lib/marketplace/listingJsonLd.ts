import { DEPLOYED_ORIGIN } from 'const/config'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import type { TeamListing } from '@/components/subscription/TeamListing'
import { getListingAvailability, getListingShareUrl } from './listing'
import { parseListingPrice } from './usdcListingPurchase'

/**
 * schema.org `priceCurrency` expects an ISO 4217 code, so only the dollar-pegged
 * currencies map cleanly. For ETH and $MOONEY we omit price rather than emit an
 * invalid code that would invalidate the whole snippet; the offer still carries
 * availability and a URL.
 */
const ISO_CURRENCIES: Record<string, string> = {
  USDC: 'USD',
  USDT: 'USD',
  DAI: 'USD',
}

const AVAILABILITY: Record<string, string> = {
  live: 'https://schema.org/InStock',
  upcoming: 'https://schema.org/PreOrder',
  ended: 'https://schema.org/SoldOut',
}

/**
 * schema.org Product markup, which is what gets a listing into Google Shopping
 * and rich results. Emitted for every listing so the marketplace gets the same
 * free distribution the jobs board gets from JobPosting.
 */
export function buildListingJsonLd({
  listing,
  teamName,
  now = Math.floor(Date.now() / 1000),
}: {
  listing: TeamListing
  teamName?: string
  now?: number
}) {
  const availability = getListingAvailability(listing, now)
  const url = getListingShareUrl(listing)
  const seller = teamName || listing.teamName || 'MoonDAO'

  const offer: Record<string, any> = {
    '@type': 'Offer',
    url,
    availability: AVAILABILITY[availability.status],
    seller: { '@type': 'Organization', name: seller },
  }

  const isoCurrency = ISO_CURRENCIES[listing.currency]
  const numericPrice = parseListingPrice(listing.price)
  if (isoCurrency && Number.isFinite(numericPrice)) {
    offer.price = numericPrice
    offer.priceCurrency = isoCurrency
  }

  if (listing.endTime > 0) {
    offer.priceValidUntil = new Date(listing.endTime * 1000).toISOString().split('T')[0]
  }

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    sku: String(listing.id),
    url,
    brand: { '@type': 'Brand', name: seller },
    offers: offer,
  }

  if (listing.image) {
    jsonLd.image = getIPFSGateway(listing.image)
  }

  jsonLd.isRelatedTo = { '@type': 'Organization', name: 'MoonDAO', url: DEPLOYED_ORIGIN }

  return jsonLd
}
