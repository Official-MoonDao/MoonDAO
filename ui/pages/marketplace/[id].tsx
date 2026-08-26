import { ArrowLeftIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { GetStaticPaths, GetStaticProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import {
  formatListingDate,
  getListingAvailability,
  getListingShareUrl,
  isGiftListing,
} from '@/lib/marketplace/listing'
import { buildListingJsonLd } from '@/lib/marketplace/listingJsonLd'
import { fetchListingById, fetchRelatedListings } from '@/lib/marketplace/marketplaceTable'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { serializeJsonLd } from '@/lib/utils/jsonLd'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ListingPurchasePanel from '@/components/marketplace/ListingPurchasePanel'
import MarketplaceListingCard from '@/components/marketplace/MarketplaceListing'
import BuyTeamListingModal from '@/components/subscription/BuyTeamListingModal'
import type { TeamListing } from '@/components/subscription/TeamListing'

type ListingTeam = {
  id: number
  name: string
  image: string
  owner: string
}

type ListingDetailProps = {
  listing: TeamListing
  team: ListingTeam | null
  relatedListings: TeamListing[]
  otherListingsCount: number
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/90">
      {children}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-b-0">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm text-white text-right break-words">{value}</dd>
    </div>
  )
}

export default function ListingDetail({
  listing,
  team,
  relatedListings,
  otherListingsCount,
}: ListingDetailProps) {
  const { selectedChain } = useContext(ChainContextV5)
  useChainDefault()

  const [buyModalEnabled, setBuyModalEnabled] = useState(false)

  const availability = getListingAvailability(listing)
  const shareUrl = getListingShareUrl(listing)
  const teamHref = team ? `/team/${team.name ? generatePrettyLink(team.name) : team.id}` : undefined
  const jsonLd = buildListingJsonLd({ listing, teamName: team?.name })

  const startDate = formatListingDate(listing.startTime)
  const endDate = formatListingDate(listing.endTime)

  const titleSection = (
    <div className="pt-2 flex flex-col gap-4">
      {team && teamHref && (
        <Link
          href={teamHref}
          className="flex items-center gap-3 w-fit text-blue-400 hover:text-blue-300"
        >
          {team.image && (
            <Image
              src={getIPFSGateway(team.image)}
              alt={team.name}
              width={32}
              height={32}
              className="rounded-full object-cover h-8 w-8"
              unoptimized
            />
          )}
          <span className="text-sm">{team.name}</span>
        </Link>
      )}
      <div className="flex flex-wrap gap-2">
        <Badge>{`Item #${listing.id}`}</Badge>
        {isGiftListing(listing) && <Badge>Gifted Citizenship</Badge>}
        {listing.currency && <Badge>{listing.currency}</Badge>}
        {listing.shipping === 'true' && <Badge>Ships to you</Badge>}
        <Badge>{availability.label}</Badge>
      </div>
    </div>
  )

  return (
    <>
      <Head
        title={listing.title}
        secondaryTitle={team?.name ? `${team.name} · MoonDAO Marketplace` : 'MoonDAO Marketplace'}
        description={listing.description}
        image={listing.image ? getIPFSGateway(listing.image) : undefined}
      >
        <script
          type="application/ld+json"
          key="listing-jsonld"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </Head>
      <Container>
        <ContentLayout
          header={listing.title}
          headerSize="max(20px, 3vw)"
          description={titleSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="pb-24 lg:pb-10">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              All marketplace items
            </Link>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
              <div className="min-w-0">
                <div className="relative w-full aspect-square max-w-[560px] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {listing.image ? (
                    <IPFSRenderer
                      src={listing.image}
                      alt={listing.title}
                      width={560}
                      height={560}
                      className="object-cover"
                      fillContainer
                      priority
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShoppingBagIcon className="h-16 w-16 text-white/20" />
                    </div>
                  )}
                </div>

                <section className="mt-8">
                  <h2 className="font-GoodTimes text-white text-lg md:text-xl mb-4">
                    About this item
                  </h2>
                  <p className="text-white/90 text-base leading-relaxed whitespace-pre-line break-words">
                    {listing.description}
                  </p>
                </section>

                <section className="mt-10">
                  <h2 className="font-GoodTimes text-white text-lg md:text-xl mb-4">Details</h2>
                  <dl className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-700/20 to-slate-800/30 px-4 py-2">
                    {team?.name && <DetailRow label="Sold by" value={team.name} />}
                    {listing.currency && <DetailRow label="Paid in" value={listing.currency} />}
                    <DetailRow
                      label="Shipping"
                      value={
                        listing.shipping === 'true'
                          ? 'Shipping address collected at checkout'
                          : 'No shipping required'
                      }
                    />
                    {startDate && <DetailRow label="Available from" value={startDate} />}
                    {endDate && <DetailRow label="Available until" value={endDate} />}
                    <DetailRow label="Item number" value={`#${listing.id}`} />
                  </dl>
                </section>
              </div>

              <aside className="lg:sticky lg:top-6 w-full">
                <ListingPurchasePanel
                  listing={listing}
                  onBuy={() => setBuyModalEnabled(true)}
                  shareUrl={shareUrl}
                  shareText={`${listing.title}${
                    team?.name ? ` from ${team.name}` : ''
                  } on the MoonDAO marketplace`}
                  teamName={team?.name}
                  teamHref={teamHref}
                  otherListingsCount={otherListingsCount}
                />
              </aside>
            </div>

            {relatedListings.length > 0 && (
              <section className="mt-12">
                <h2 className="font-GoodTimes text-white text-lg md:text-xl mb-4">Other items</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {relatedListings.map((related) => (
                    <MarketplaceListingCard
                      key={`related-listing-${related.id}`}
                      listing={related}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </ContentLayout>
      </Container>

      {availability.isPurchasable && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-900/95 backdrop-blur px-4 py-3">
          <button
            type="button"
            onClick={() => setBuyModalEnabled(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <ShoppingBagIcon className="h-5 w-5" />
            Buy now
          </button>
        </div>
      )}

      {buyModalEnabled && (
        <BuyTeamListingModal
          selectedChain={selectedChain}
          listing={listing}
          recipient={team?.owner}
          setEnabled={setBuyModalEnabled}
        />
      )}
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: 'blocking',
})

export const getStaticProps: GetStaticProps<ListingDetailProps> = async ({ params }) => {
  const chain = DEFAULT_CHAIN_V5
  const id = Number(params?.id)

  if (!Number.isInteger(id) || id < 0) {
    return { notFound: true }
  }

  try {
    const listing = await fetchListingById(chain, id)
    if (!listing) return { notFound: true, revalidate: 60 }

    // Both are best-effort: a degraded RPC should narrow the page, not 500 it.
    const [team, related] = await Promise.all([
      loadListingTeam(chain, listing.teamId),
      fetchRelatedListings(chain, listing).catch(() => ({
        listings: [] as TeamListing[],
        otherCount: 0,
      })),
    ])

    return {
      props: {
        listing,
        team,
        relatedListings: related.listings,
        otherListingsCount: related.otherCount,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(`Failed to build marketplace listing page ${id}:`, error)
    return { notFound: true, revalidate: 60 }
  }
}

async function loadListingTeam(chain: any, teamId: number): Promise<ListingTeam | null> {
  try {
    const { fetchTeamWithOwner } = await import('@/lib/team/teamDataService')
    const team = await fetchTeamWithOwner(chain, teamId)
    if (!team) return null
    return {
      id: teamId,
      name: (team.metadata?.name as string) || `Team #${teamId}`,
      image: (team.metadata?.image as string) || '',
      owner: (team as any).owner || '',
    }
  } catch (error) {
    console.error(`Failed to load team ${teamId} for listing page:`, error)
    return null
  }
}
