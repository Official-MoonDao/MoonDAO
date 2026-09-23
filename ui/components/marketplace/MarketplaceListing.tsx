import { useRouter } from 'next/router'
import { useContext } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { formatListingPrice, getListingHref } from '@/lib/marketplace/listing'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import AdaptiveImage from '@/components/layout/AdaptiveImage'
import ExpandableText from '@/components/layout/ExpandableText'
import type { TeamListing } from '@/components/subscription/TeamListing'

type MarketplaceListingProps = {
  listing: TeamListing
}

export default function MarketplaceListing({ listing }: MarketplaceListingProps) {
  const { citizen } = useContext(CitizenContext)
  const router = useRouter()

  const href = getListingHref(listing)
  const price = formatListingPrice(listing, !!citizen)

  const handleTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/team/${listing.teamName ? generatePrettyLink(listing.teamName) : listing.teamId}`)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(href)
        }
      }}
      className="group h-full w-full cursor-pointer p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_0_20px_rgba(37,99,235,0.2),0_0_40px_rgba(147,51,234,0.15)]"
    >
      <div className="flex h-full w-full gap-4">
        {listing.image && (
          <div className="relative h-[90px] w-[90px] sm:h-[110px] sm:w-[110px] flex-shrink-0">
            <AdaptiveImage
              className="h-full w-full rounded-xl border border-white/10 object-cover"
              src={listing.image}
              width={500}
              height={500}
              alt={listing.title || ''}
            />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
              {`#${listing.id}`}
            </span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-GoodTimes text-lg leading-tight text-white break-words line-clamp-2 transition-colors group-hover:text-slate-200">
            {listing.title}
          </h3>
          <button
            onClick={handleTeamClick}
            className="mt-1 w-fit text-left text-xs text-slate-400 transition-colors hover:text-white hover:underline"
          >
            {listing.teamName || `Team ${listing.teamId}`}
          </button>
          <div className="mt-1.5">
            <ExpandableText className="text-sm leading-relaxed text-slate-300/80" lines={2}>
              {listing.description}
            </ExpandableText>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            <p className="font-GoodTimes text-base text-white">{price.display}</p>
            {!price.isFree && citizen ? (
              <span className="text-xs text-slate-400 line-through opacity-70">{price.full}</span>
            ) : null}
            {!price.isFree && !citizen && price.savings ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  router.push('/citizen')
                }}
                className="rounded bg-light-warm px-2 py-1 text-xs text-black transition-colors hover:bg-light-warm/80"
              >
                Save 10% with citizenship
              </button>
            ) : null}
          </div>
          <span className="mt-2 text-xs text-blue-400 transition-colors group-hover:text-blue-300">
            View item →
          </span>
        </div>
      </div>
    </div>
  )
}
