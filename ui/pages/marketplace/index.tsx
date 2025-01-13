import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import MarketplaceABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  MARKETPLACE_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  TEAM_ADDRESSES,
} from 'const/config'
import { useContext, useEffect, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import ChainContext from '@/lib/thirdweb/chain-context'
import { initSDK } from '@/lib/thirdweb/thirdweb'
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
  const { selectedChain } = useContext(ChainContext)
  const { citizen } = useContext(CitizenContext)

  const [filteredListings, setFilteredListings] = useState<TeamListingType[]>()
  const [input, setInput] = useState('')

  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug]
  )
  const { contract: marketplaceTableContract } = useContract(
    MARKETPLACE_TABLE_ADDRESSES[selectedChain.slug]
  )

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
        title={"Marketplace"}
        description={'Explore the Space Acceleration Network Marketplace! Browse and buy innovative space products and services from pioneering teams driving the future of the space economy.'}
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
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)
  const now = Math.floor(Date.now() / 1000)

  const marketplaceTableContract = await sdk.getContract(
    MARKETPLACE_TABLE_ADDRESSES[chain.slug],
    MarketplaceABI
  )
  const teamContract = await sdk.getContract(
    TEAM_ADDRESSES[chain.slug],
    TeamABI
  )

  const marketplaceTableName = await marketplaceTableContract.call(
    'getTableName'
  )

  const statement = `SELECT * FROM ${marketplaceTableName} WHERE (startTime = 0 OR startTime <= ${now}) AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`

  const allListingsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${statement}`
  )
  const allListings = await allListingsRes.json()

  const validListings = allListings.filter(async (listing: TeamListingType) => {
    const teamExpiration = await teamContract.call('expiresAt', [
      listing.teamId,
    ])
    return teamExpiration.toNumber() > now
  })

  return {
    props: {
      listings: validListings,
    },
    revalidate: 60,
  }
}
