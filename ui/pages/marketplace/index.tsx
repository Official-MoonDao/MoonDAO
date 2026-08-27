import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { fetchActiveListings } from '@/lib/marketplace/marketplaceTable'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { useShallowQueryRoute } from '@/lib/utils/hooks/useShallowQueryRoute'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import PaginationButtons from '@/components/layout/PaginationButtons'
import Search from '@/components/layout/Search'
import MarketplaceListing from '@/components/marketplace/MarketplaceListing'

type MarketplaceListing = {
  id: number
  teamId: number
  title: string
  description: string
  image: string
  price: string
  currency: string
  startTime: number
  endTime: number
  timestamp: number
  metadata: string
  shipping: string
  tag: string
  teamName?: string
}

type MarketplaceProps = {
  listings: MarketplaceListing[]
}

export default function Marketplace({ listings }: MarketplaceProps) {
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>(listings || [])
  const [input, setInput] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [pageIdx, setPageIdx] = useState(1)

  // Build the team filter options from the listings themselves so the dropdown
  // only ever shows teams that actually have items for sale.
  const teamOptions = useMemo(() => {
    const teams = new Map<string, string>()
    ;(listings || []).forEach((listing: MarketplaceListing) => {
      const id = String(listing.teamId)
      if (!teams.has(id)) teams.set(id, listing.teamName || `Team ${listing.teamId}`)
    })
    const sorted = Array.from(teams.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return [{ value: 'all', label: 'All Teams' }, ...sorted]
  }, [listings])

  const ITEMS_PER_PAGE = 8 // 4 items per row x 2 rows

  useChainDefault()

  // Handle URL parameters for pagination
  useEffect(() => {
    const { page: urlPage } = router.query
    if (urlPage && !isNaN(Number(urlPage))) {
      setPageIdx(Number(urlPage))
    }
  }, [router.query])

  function handlePageChange(newPage: number) {
    setPageIdx(newPage)
    shallowQueryRoute({ page: newPage.toString() })
  }

  useEffect(() => {
    let result = listings || []

    if (selectedTeam !== 'all') {
      result = result.filter(
        (listing: MarketplaceListing) => String(listing.teamId) === selectedTeam,
      )
    }

    if (input.trim() !== '') {
      const query = input.toLowerCase()
      result = result.filter((listing: MarketplaceListing) =>
        listing.title.toLowerCase().includes(query),
      )
    }

    setFilteredListings(result)

    // Reset to the first page whenever a filter is active so users don't land
    // on an out-of-range page; leave pagination alone on the default view so
    // deep links to a specific page keep working.
    if (selectedTeam !== 'all' || input.trim() !== '') {
      setPageIdx(1)
    }
  }, [listings, input, selectedTeam])

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">
        Discover space products and services from top innovators and teams in the Space Acceleration
        Network, available for direct on-chain purchase.
      </div>
      <div className="relative w-full flex flex-col gap-3">
        {/* Search Bar */}
        <div className="flex w-full md:w-5/6 flex-col min-[1200px]:flex-row md:gap-2">
          <div className="w-full flex flex-row min-[800px]:flex-row gap-2 sm:gap-4 items-center">
            {/* Search Bar */}
            <div className="w-full min-w-0 max-w-[260px] bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1">
              <Search
                className="w-full flex-grow"
                input={input}
                setInput={setInput}
                placeholder="Search items..."
              />
            </div>
            {/* Team filter dropdown */}
            <div className="relative w-[10rem] sm:w-[12rem] flex-shrink-0">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                aria-label="Filter by team"
                className="w-full cursor-pointer appearance-none rounded-xl bg-black/20 backdrop-blur-sm border border-white/10 py-2 pl-3 pr-9 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
              >
                {teamOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-dark-cool text-white"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <section id="marketplace-container" className="overflow-hidden">
      <Head
        title={'Marketplace'}
        description={
          'Explore the Space Acceleration Network Marketplace! Browse and buy innovative space products and services from pioneering teams driving the future of the space economy.'
        }
        image="https://ipfs.io/ipfs/QmTtEyhgwcE1xyqap4nvaXyPpMBnfskRPtnz7i1jpGnw5M"
      />
      <Container>
        <ContentLayout
          header="Marketplace"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="flex flex-row w-full">
            <div className="p-4 md:px-8 bg-black/20 backdrop-blur-sm border border-white/10 lg:p-8 rounded-[2vmax] md:m-5 mb-0 md:mb-0 w-full flex flex-col lg:max-w-[1400px]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-fr">
                {filteredListings && filteredListings.length > 0 ? (
                  (() => {
                    const startIdx = (pageIdx - 1) * ITEMS_PER_PAGE
                    const endIdx = startIdx + ITEMS_PER_PAGE
                    const paginatedListings = filteredListings.slice(startIdx, endIdx)
                    return paginatedListings.map((listing: MarketplaceListing, i: number) => (
                      <MarketplaceListing
                        key={`marketplace-listing-${startIdx + i}`}
                        listing={listing}
                      />
                    ))
                  })()
                ) : (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-400">
                      {input || selectedTeam !== 'all'
                        ? 'No listings match your search criteria.'
                        : 'No marketplace listings available at this time.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredListings && filteredListings.length > ITEMS_PER_PAGE && (
                <div className="mt-8">
                  <PaginationButtons
                    handlePageChange={handlePageChange}
                    maxPage={Math.ceil(filteredListings.length / ITEMS_PER_PAGE)}
                    pageIdx={pageIdx}
                    label="Page"
                  />
                </div>
              )}
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const listings = await fetchActiveListings(DEFAULT_CHAIN_V5)

    return {
      props: { listings },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    // Don't let a transient failure cache an empty marketplace for a full
    // minute. Revalidate quickly so the next request can repopulate listings.
    return {
      props: { listings: [] },
      revalidate: 10,
    }
  }
}
