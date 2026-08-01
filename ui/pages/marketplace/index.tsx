import { ChevronDownIcon } from '@heroicons/react/24/outline'
import MarketplaceABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  MARKETPLACE_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import getProjectActiveMap from '@/lib/project/getProjectActiveMap'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
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
  const { selectedChain } = useContext(ChainContextV5)
  const { citizen } = useContext(CitizenContext)
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()
  const chainSlug = getChainSlug(selectedChain)

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

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })

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
        (listing: MarketplaceListing) => String(listing.teamId) === selectedTeam
      )
    }

    if (input.trim() !== '') {
      const query = input.toLowerCase()
      result = result.filter((listing: MarketplaceListing) =>
        listing.title.toLowerCase().includes(query)
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
            <div className="w-fit max-w-[260px] bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1">
              <Search
                className="w-full flex-grow"
                input={input}
                setInput={setInput}
                placeholder="Search items..."
              />
            </div>
            {/* Team filter dropdown */}
            <div className="relative w-[10rem] sm:w-[12rem]">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                aria-label="Filter by team"
                className="w-full cursor-pointer appearance-none rounded-xl bg-black/20 backdrop-blur-sm border border-white/10 py-2 pl-3 pr-9 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
              >
                {teamOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-dark-cool text-white">
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
                        teamContract={teamContract}
                        selectedChain={selectedChain}
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
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const now = Math.floor(Date.now() / 1000)

    const marketplaceTableContract = getContract({
      client: serverClient,
      chain,
      address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
      abi: MarketplaceABI as any,
    })
    const teamContract = getContract({
      client: serverClient,
      chain,
      address: TEAM_ADDRESSES[chainSlug],
      abi: TeamABI as any,
    })

    // The table name is a known constant, so prefer it and avoid an RPC call on
    // the critical path. Only fall back to the on-chain lookup if the constant
    // is somehow missing. A rate-limited getTableName() previously took down the
    // entire page (every render fell into the catch block below).
    let marketplaceTableName: any = MARKETPLACE_TABLE_NAMES[chainSlug]
    if (!marketplaceTableName) {
      marketplaceTableName = await readContract({
        contract: marketplaceTableContract,
        method: 'getTableName',
      })
    }

    const statement = `SELECT * FROM ${marketplaceTableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`

    const allListings = await queryTable(chain, statement)

    // Resolve each team's expiration only once. Multiple listings frequently
    // share a teamId, so de-duping drastically cuts the number of RPC calls and
    // therefore the chance of getting rate limited under heavy traffic.
    const uniqueTeamIds = Array.from(
      new Set(allListings.map((listing: any) => listing.teamId))
    )

    async function getTeamExpiration(
      teamId: any,
      retries = 3,
      delay = 500
    ): Promise<number | null> {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const teamExpiration = await readContract({
            contract: teamContract,
            method: 'expiresAt',
            params: [teamId],
          })
          return +teamExpiration.toString()
        } catch (error) {
          if (attempt < retries - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, delay * Math.pow(2, attempt))
            )
            continue
          }
          // Persistent failure (likely rate limiting). Return null so the
          // caller can decide to "fail open" rather than dropping listings.
          return null
        }
      }
      return null
    }

    // Process unique teams in batches to check expiration and avoid rate limiting
    const BATCH_SIZE = 10
    const DELAY_BETWEEN_BATCHES = 100 // ms
    const teamExpirations = new Map<any, number | null>()

    for (let i = 0; i < uniqueTeamIds.length; i += BATCH_SIZE) {
      const batch = uniqueTeamIds.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (teamId: any) => {
          teamExpirations.set(teamId, await getTeamExpiration(teamId))
        })
      )

      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < uniqueTeamIds.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        )
      }
    }

    // Project-teams (projects that are teams under the hood) are gated by the
    // ProjectV2 `active` flag rather than subscription expiry.
    const projectActiveByTeamId = await getProjectActiveMap(chain, chainSlug)

    // Keep a listing when its team is unexpired. If the expiration could not be
    // resolved (null, e.g. rate limited), fail open and keep the listing so a
    // transient RPC issue never wipes out the entire marketplace.
    const validListings = allListings.filter((listing: any) => {
      const projectActive = projectActiveByTeamId.get(String(listing.teamId))
      if (projectActive !== undefined) {
        return projectActive === PROJECT_ACTIVE
      }
      const expiration = teamExpirations.get(listing.teamId)
      return expiration === null || expiration === undefined || expiration > now
    })

    // Team names are a nice-to-have label. A failure here must not discard the
    // listings we already fetched, so resolve it best-effort.
    let allTeamNames: any[] = []
    try {
      allTeamNames = await queryTable(
        chain,
        `SELECT id, name FROM ${TEAM_TABLE_NAMES[chainSlug]}`
      )
    } catch (error) {
      console.error('Failed to fetch team names for marketplace listings:', error)
    }

    const listingsWithTeamNames = validListings.map((listing: any) => {
      return {
        ...listing,
        teamName: allTeamNames.find((team: any) => team.id === listing.teamId)?.name,
      }
    })

    return {
      props: {
        listings: listingsWithTeamNames,
      },
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
