import MarketplaceABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  MARKETPLACE_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import CitizenContext from '@/lib/citizen/citizen-context'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks/useShallowQueryRoute'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import PaginationButtons from '@/components/layout/PaginationButtons'
import Search from '@/components/layout/Search'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import BuyTeamListingModal from '@/components/subscription/BuyTeamListingModal'

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

  const [filteredListings, setFilteredListings] =
    useState<MarketplaceListing[]>()
  const [input, setInput] = useState('')
  const [pageIdx, setPageIdx] = useState(1)
  const [selectedListing, setSelectedListing] =
    useState<MarketplaceListing | null>(null)
  const [teamNFTOwner, setTeamNFTOwner] = useState<string | null>(null)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(false)

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

  async function handleListingClick(listing: MarketplaceListing) {
    try {
      // Get the team NFT to find the owner (recipient for purchases)
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(listing.teamId),
        includeOwner: true,
      })
      setTeamNFTOwner(nft?.owner || null)
      setSelectedListing(listing)
      setEnabledBuyListingModal(true)
    } catch (error) {
      console.error('Error fetching team NFT:', error)
      // Fallback to redirect if modal fails
      router.push(`/team/${listing.teamId}?listing=${listing.id}`)
    }
  }

  useEffect(() => {
    if (listings && input != '') {
      const filtered = listings.filter((listing: MarketplaceListing) => {
        return listing.title.toLowerCase().includes(input.toLowerCase())
      })
      setFilteredListings(filtered)
      setPageIdx(1) // Reset to first page when filtering
    } else {
      setFilteredListings(listings)
    }
  }, [listings, input])

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">
        Discover space products and services from top innovators and teams in
        the Space Acceleration Network, available for direct on-chain purchase.
      </div>
      <div className="relative w-full flex flex-col gap-3">
        {/* Search Bar */}
        <div className="flex w-full md:w-5/6 flex-col min-[1200px]:flex-row md:gap-2">
          <div className="w-full flex flex-row min-[800px]:flex-row gap-4 items-center">
            {/* Search Bar */}
            <div className="w-fit max-w-[260px] bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1">
              <Search
                className="w-full flex-grow"
                input={input}
                setInput={setInput}
                placeholder="Search marketplace..."
              />
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
                    const paginatedListings = filteredListings.slice(
                      startIdx,
                      endIdx
                    )

                    return paginatedListings.map(
                      (listing: MarketplaceListing, i: number) => (
                        <div
                          key={`marketplace-listing-${startIdx + i}`}
                          className="h-full"
                        >
                          <StandardDetailCard
                            title={listing.title}
                            paragraph={listing.description}
                            image={listing.image}
                            price={listing.price}
                            currency={listing.currency}
                            isCitizen={!!citizen}
                            onClick={() => handleListingClick(listing)}
                          />
                        </div>
                      )
                    )
                  })()
                ) : (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-400">
                      {input
                        ? 'No listings match your search criteria.'
                        : 'No marketplace listings available at this time.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredListings && filteredListings.length > ITEMS_PER_PAGE && (
                <div className="w-full rounded-[2vmax] bg-black/20 backdrop-blur-sm border border-white/10 p-6 mt-8">
                  <div className="w-full flex justify-center">
                    <PaginationButtons
                      handlePageChange={handlePageChange}
                      maxPage={Math.ceil(
                        filteredListings.length / ITEMS_PER_PAGE
                      )}
                      pageIdx={pageIdx}
                      label="Page"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </ContentLayout>
      </Container>

      {/* Buy Listing Modal */}
      {enabledBuyListingModal && selectedListing && (
        <BuyTeamListingModal
          selectedChain={selectedChain}
          listing={selectedListing}
          recipient={teamNFTOwner}
          setEnabled={setEnabledBuyListingModal}
        />
      )}
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

    const marketplaceTableName = await readContract({
      contract: marketplaceTableContract,
      method: 'getTableName',
    })

    const statement = `SELECT * FROM ${marketplaceTableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`

    const allListings = await queryTable(chain, statement)

    const validListings = allListings.filter(async (listing: any) => {
      const teamExpiration = await readContract({
        contract: teamContract,
        method: 'expiresAt',
        params: [listing.teamId],
      })
      return +teamExpiration.toString() > now
    })

    console.log(validListings)

    return {
      props: {
        listings: validListings,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { listings: [] },
      revalidate: 60,
    }
  }
}
