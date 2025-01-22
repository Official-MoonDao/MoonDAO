import MarketplaceABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  MARKETPLACE_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import IndexCardGridContainer from '@/components/layout/IndexCardGridContainer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import TeamListing, {
  TeamListing as TeamListingType,
} from '@/components/subscription/TeamListing'

type MarketplaceProps = {
  listings: TeamListingType[]
}

export default function Marketplace({ listings }: MarketplaceProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { citizen } = useContext(CitizenContext)

  const [filteredListings, setFilteredListings] = useState<TeamListingType[]>()
  const [input, setInput] = useState('')

  const { contract: teamContract } = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })
  const { contract: marketplaceTableContract } = useContract({
    chain: selectedChain,
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    abi: MarketplaceABI as any,
  })

  useEffect(() => {
    if (listings && input != '') {
      setFilteredListings(
        listings.filter((listing: TeamListingType) => {
          return listing.title.toLowerCase().includes(input.toLowerCase())
        })
      )
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
      <Frame bottomLeft="20px" topLeft="5vmax" marginBottom="10px" noPadding>
        <Search input={input} setInput={setInput} />
      </Frame>
    </div>
  )

  return (
    <section id="jobs-container" className="overflow-hidden">
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
          <IndexCardGridContainer>
            {filteredListings &&
              filteredListings.map((listing: TeamListingType, i: number) => (
                <TeamListing
                  key={`team-listing-${i}`}
                  selectedChain={selectedChain}
                  listing={listing}
                  teamContract={teamContract}
                  marketplaceTableContract={marketplaceTableContract}
                  teamName
                  isCitizen={citizen}
                />
              ))}
          </IndexCardGridContainer>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
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

  return {
    props: {
      listings: validListings,
    },
    revalidate: 60,
  }
}
