import CitizenTableABI from 'const/abis/CitizenTable.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import {
  ARBITRUM_ASSETS_URL,
  BASE_ASSETS_URL,
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  POLYGON_ASSETS_URL,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
} from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { getContract, readContract } from 'thirdweb'
import { MediaRenderer, useActiveAccount } from 'thirdweb/react'
import { useAssets } from '@/lib/dashboard/hooks'
import useNewestProposals from '@/lib/nance/useNewestProposals'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client, { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalMooneyBalance } from '@/lib/tokens/hooks/useTotalMooneyBalance'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import { getRelativeQuarter } from '@/lib/utils/dates'
import useStakedEth from '@/lib/utils/hooks/useStakedEth'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'
import { getBudget } from '@/lib/utils/rewards'
import Container from '@/components/layout/Container'
import Frame from '@/components/layout/Frame'

function truncateText(text: string, maxLength: number) {
  if (text?.length <= maxLength) return text
  return text?.slice(0, maxLength) + '...'
}

function HomeCard({
  title,
  description,
  image,
  href,
}: {
  title: string
  description: string
  image: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="relative animate-fadeIn flex flex-row bg-dark-cool w-full rounded-lg overflow-hidden border border-gray-800 hover:scale-105 transition-all duration-300"
    >
      {/* Image section */}
      {image && (
        <div className="relative w-16 h-16 flex-shrink-0">
          {image.startsWith('ipfs://') ? (
            <MediaRenderer
              client={client}
              src={image}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image
              src={image}
              alt={title}
              className="w-full h-full object-cover"
              width={64}
              height={64}
            />
          )}
        </div>
      )}

      {/* Content container */}
      <div className="relative z-10 p-2 flex flex-col justify-center flex-1">
        <h2 className="text-sm font-GoodTimes text-white mb-0.5">{title}</h2>
        <p className="text-xs text-gray-400 line-clamp-2">
          {truncateText(description, 60)}
        </p>
      </div>
    </Link>
  )
}

function BalanceItem({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex flex-col p-2 bg-dark-cool rounded-lg border border-gray-800">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  )
}

export default function Home({
  newestNewsletters,
  newestCitizens,
  newestListings,
  newestJobs,
}: any) {
  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const { proposals, packet, votingInfoMap } = useNewestProposals(100)
  const account = useActiveAccount()
  const address = account?.address

  const MOONEYBalance = useTotalMooneyBalance(address)
  const VMOONEYBalance = useTotalVP(address || '')

  const { quarter, year } = getRelativeQuarter(0)

  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)
  const { stakedEth, error } = useStakedEth()

  const tokens = mainnetTokens
    .concat(arbitrumTokens)
    .concat(polygonTokens)
    .concat(baseTokens)
    .concat([{ symbol: 'stETH', balance: stakedEth }])

  const { ethBudget, usdBudget, mooneyBudget, ethPrice } = getBudget(
    tokens,
    year,
    quarter
  )

  const votingEscrowDepositorContract = useContract({
    address: VOTING_ESCROW_DEPOSITOR_ADDRESSES[chainSlug],
    abi: VotingEscrowDepositor.abi,
    chain: selectedChain,
  })

  const withdrawable = useWithdrawAmount(votingEscrowDepositorContract, address)

  return (
    <Container>
      <div className="flex flex-col gap-4 mt-24">
        {/* Top Row: Balances, Budget, Proposals, and Listings */}
        <div className="grid grid-cols-4 gap-4">
          {/* Balances Section */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="w-full p-4 bg-slide-section">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-GoodTimes text-white">Balances</h2>
              </div>
              <div className="flex flex-col gap-2">
                <BalanceItem
                  label="$MOONEY"
                  value={
                    MOONEYBalance
                      ? Math.round(MOONEYBalance).toLocaleString()
                      : 0
                  }
                />
                <BalanceItem
                  label="Voting Power"
                  value={
                    VMOONEYBalance
                      ? Math.round(VMOONEYBalance).toLocaleString()
                      : 0
                  }
                />
                <BalanceItem
                  label="Rewards"
                  value={
                    withdrawable
                      ? Math.round(Number(withdrawable / 1e18)).toLocaleString()
                      : 0
                  }
                />
              </div>
            </div>
          </Frame>

          {/* Budget Section */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="w-full p-4 bg-slide-section">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-GoodTimes text-white">Budget</h2>
                <div className="text-xs text-gray-400">
                  Q{quarter} {year}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <BalanceItem
                  label="ETH Budget"
                  value={`${ethBudget.toFixed(2)} ETH`}
                />
                <BalanceItem
                  label="USD Budget"
                  value={`$${usdBudget.toFixed(0)}`}
                />
              </div>
            </div>
          </Frame>

          {/* Active Proposals */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="w-full p-4 bg-slide-section">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-GoodTimes text-white">Proposals</h2>
                <div className="text-xs text-gray-400">
                  {proposals?.length || 0}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {proposals?.slice(0, 2).map((proposal: any) => (
                  <HomeCard
                    key={proposal.proposalId}
                    title={proposal.title}
                    description={''}
                    image={''}
                    href={`/proposal/${proposal.proposalId}`}
                  />
                ))}
              </div>
            </div>
          </Frame>

          {/* Newest Listings */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="w-full p-4 bg-slide-section">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-GoodTimes text-white">Listings</h2>
              </div>
              <div className="flex flex-col gap-2">
                {newestListings.slice(0, 2).map((listing: any) => (
                  <HomeCard
                    key={listing.id}
                    title={listing.title}
                    description={listing.description}
                    image={listing.image}
                    href={`/team/${listing.teamId}?listing=${listing.id}`}
                  />
                ))}
              </div>
            </div>
          </Frame>
        </div>

        {/* Bottom Row: Jobs and Citizens */}
        <div className="grid grid-cols-2 gap-4">
          {/* Latest Jobs */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="w-full p-4 bg-slide-section">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-GoodTimes text-white">Jobs</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {newestJobs.slice(0, 4).map((job: any) => (
                  <HomeCard
                    key={job.id}
                    title={job.title}
                    description={job.description}
                    image={job.image}
                    href={`/team/${job.teamId}?job=${job.id}`}
                  />
                ))}
              </div>
            </div>
          </Frame>

          {/* Newest Citizens */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div className="w-full p-4 bg-slide-section">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-GoodTimes text-white">
                  Newest Citizens
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {newestCitizens.slice(0, 4).map((citizen: any) => (
                  <HomeCard
                    key={citizen.id}
                    title={citizen.name}
                    description={citizen.description}
                    image={citizen.image}
                    href={`/citizen/${generatePrettyLinkWithId(
                      citizen.name,
                      citizen.id
                    )}`}
                  />
                ))}
              </div>
            </div>
          </Frame>
        </div>
      </div>
    </Container>
  )
}

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const newestNewsletters: any = []

  const citizenTableContract = getContract({
    client: serverClient,
    address: CITIZEN_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: CitizenTableABI as any,
  })
  const citizenTableName = await readContract({
    contract: citizenTableContract,
    method: 'getTableName',
  })
  const newestCitizens: any = await queryTable(
    chain,
    `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 10`
  )

  const marketplaceTableContract = getContract({
    client: serverClient,
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: MarketplaceTableABI as any,
  })
  const marketplaceTableName = await readContract({
    contract: marketplaceTableContract,
    method: 'getTableName',
  })
  const newestListings: any = await queryTable(
    chain,
    `SELECT * FROM ${marketplaceTableName} ORDER BY id DESC LIMIT 10`
  )

  const jobTableContract = getContract({
    client: serverClient,
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: JobTableABI as any,
  })
  const jobTableName = await readContract({
    contract: jobTableContract,
    method: 'getTableName',
  })
  const newestJobs: any = await queryTable(
    chain,
    `SELECT * FROM ${jobTableName} ORDER BY id DESC LIMIT 10`
  )

  return {
    props: {
      newestNewsletters,
      newestCitizens,
      newestListings,
      newestJobs,
    },
    revalidate: 60,
  }
}
