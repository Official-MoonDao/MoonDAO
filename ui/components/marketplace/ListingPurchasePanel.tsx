import { ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import {
  formatListingPrice,
  getListingAvailability,
  isGiftListing,
} from '@/lib/marketplace/listing'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import ShareButtons from '@/components/layout/ShareButtons'
import type { TeamListing } from '@/components/subscription/TeamListing'

type ListingPurchasePanelProps = {
  listing: TeamListing
  onBuy: () => void
  shareUrl: string
  shareText: string
  teamName?: string
  teamHref?: string
  otherListingsCount?: number
}

export default function ListingPurchasePanel({
  listing,
  onBuy,
  shareUrl,
  shareText,
  teamName,
  teamHref,
  otherListingsCount,
}: ListingPurchasePanelProps) {
  const { citizen } = useContext(CitizenContext)
  const currTime = useCurrUnixTime(60000)

  // The page is served from an ISR cache, so anything relative to "now" would
  // disagree with the pre-rendered HTML on hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const availability = getListingAvailability(listing, currTime)
  const price = formatListingPrice(listing, !!citizen)
  const isGift = isGiftListing(listing)
  const shipping = listing.shipping === 'true'

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-700/30 to-slate-800/40 backdrop-blur-xl p-5 flex flex-col gap-4">
      <div>
        <p id="listing-price" className="font-GoodTimes text-white text-2xl leading-tight">
          {price.display}
        </p>
        {!price.isFree && !isGift && citizen && (
          <p className="text-sm text-slate-400 line-through mt-1">{price.full}</p>
        )}
        {!price.isFree && !isGift && !citizen && price.savings && (
          <Link
            href="/citizen"
            id="listing-savings"
            className="mt-2 inline-block rounded bg-light-warm px-2 py-1 text-xs text-black transition-colors hover:bg-light-warm/80"
          >
            {`Save ${price.savings} with citizenship`}
          </Link>
        )}
        {mounted && (
          <p
            className={`text-sm mt-2 ${
              availability.status === 'live' ? 'text-blue-300' : 'text-yellow-400/80'
            }`}
          >
            {availability.label}
          </p>
        )}
      </div>

      {availability.isPurchasable ? (
        <button
          id="listing-buy-button"
          type="button"
          onClick={onBuy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
        >
          <ShoppingBagIcon className="h-5 w-5" />
          Buy now
        </button>
      ) : (
        <p className="text-sm text-slate-400">
          {availability.status === 'upcoming'
            ? 'This item is not on sale yet. Check back on the date above.'
            : 'This item is no longer available.'}
        </p>
      )}

      <ShareButtons url={shareUrl} text={shareText} />

      {shipping && (
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <TruckIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>A shipping address is collected at checkout.</span>
        </div>
      )}

      {teamName && teamHref && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sold by</p>
          <Link href={teamHref} className="text-sm text-blue-400 hover:text-blue-300">
            {teamName}
          </Link>
        </div>
      )}

      {otherListingsCount ? (
        <Link
          href="/marketplace"
          className="text-sm text-blue-400 hover:text-blue-300"
        >{`See ${otherListingsCount} other item${otherListingsCount === 1 ? '' : 's'} →`}</Link>
      ) : (
        <Link href="/marketplace" className="text-sm text-blue-400 hover:text-blue-300">
          Browse the full marketplace →
        </Link>
      )}

      <p className="text-xs text-slate-500 leading-relaxed">
        Payment goes directly to the selling team onchain. MoonDAO Citizens pay no markup.
      </p>
    </div>
  )
}
