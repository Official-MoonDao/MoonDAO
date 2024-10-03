import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import {
  MARKETPLACE_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  TEAM_ADDRESSES,
} from 'const/config'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
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
    <div>
      <Frame
        bottomLeft="20px"
        topLeft="5vmax"
        marginBottom="30px"
        marginTop="30px"
        noPadding
      >
        <Search input={input} setInput={setInput} />
      </Frame>
    </div>
  )

  return (
    <section id="jobs-container" className="overflow-hidden">
      <Head title="Marketplace" image="" />
      <Container>
        <ContentLayout
          header="Marketplace"
          headerSize="max(20px, 3vw)"
          description={
            <p>
              Cast your vote for active proposals and view the vote record and
              history for all past proposals. You can{' '}
              <u>
                <Link href="/propose">submit a proposal</Link>
              </u>{' '}
              to receive financing or support from the MoonDAO community. Please
              refer to{' '}
              <u>
                <Link
                  href="https://docs.moondao.com/Projects/Project-System"
                  target="_blank"
                  rel="noreferrer"
                >
                  our documentation
                </Link>
              </u>{' '}
              for more details on the project system and governance processes.
            </p>
          }
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

  const marketplaceTableContract = await sdk.getContract(
    MARKETPLACE_TABLE_ADDRESSES[chain.slug]
  )
  const teamContract = await sdk.getContract(TEAM_ADDRESSES[chain.slug])

  const marketplaceTableName = await marketplaceTableContract.call(
    'getTableName'
  )

  const statement = `SELECT * FROM ${marketplaceTableName}`

  const allListingsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${statement}`
  )
  const allListings = await allListingsRes.json()

  const now = Math.floor(Date.now() / 1000)

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
