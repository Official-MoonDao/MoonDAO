import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import CompetitorABI from 'const/abis/Competitor.json'
import ERC20 from 'const/abis/ERC20.json'
import REVDeployer from 'const/abis/REVDeployer.json'
import {
  DEPRIZE_DISTRIBUTION_TABLE_ADDRESSES,
  DEPRIZE_ID,
  PRIZE_TOKEN_ADDRESSES,
  COMPETITOR_TABLE_ADDRESSES,
  PRIZE_DECIMALS,
  REVNET_ADDRESSES,
  PRIZE_REVNET_ID,
} from 'const/config'
import { TEAM_ADDRESSES } from 'const/config'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import useTokenSupply from '@/lib/tokens/hooks/useTokenSupply'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import Market from '@/components/betting/Market'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { CompetitorPreview } from '@/components/nance/CompetitorPreview'
import { JoinDePrizeModal } from '@/components/nance/JoinDePrizeModal'
import StandardButton from '../layout/StandardButton'

export type Metadata = {}
export type Competitor = {
  id: string
  deprize: number
  teamId: number
  metadata: Metadata
}
export type Distribution = {
  deprize: number
  address: string
  timestamp: number
  distribution: { [key: string]: number }
}

export type DePrizeProps = {
  competitors: Competitor[]
  distributions: Distribution[]
  refreshRewards: () => void
}

export function DePrize({
  competitors,
  distributions,
  refreshRewards,
}: DePrizeProps) {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const { isMobile } = useWindowSize()
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const userAddress = useAddress()
  const quarter = Math.floor((new Date().getMonth() + 3) / 3) - 1

  const { contract: prizeContract } = useContract(
    PRIZE_TOKEN_ADDRESSES[chain.slug],
    ERC20.abi
  )
  const { contract: competitorContract } = useContract(
    COMPETITOR_TABLE_ADDRESSES[chain.slug],
    CompetitorABI
  )
  const { contract: teamContract } = useContract(TEAM_ADDRESSES[chain.slug])

  const prizeBalance = useWatchTokenBalance(prizeContract, PRIZE_DECIMALS)
  const userHasVotingPower = prizeBalance > 0
  const prizeSupply = useTokenSupply(prizeContract, PRIZE_DECIMALS)
  const prizeBudget = prizeSupply * 0.1
  const winnerPool = prizeSupply * 0.3
  const prizePrice = 1

  const userTeams = useTeamWearer(teamContract, chain, userAddress)
  console.log('userTeams:', userTeams)

  const isCompetitor = userTeams.some((team: any) =>
    competitors.some(
      (competitor) => competitor.teamId.toString() === team.teamId
    )
  )
  const handleJoinWithTeam = async (teamId: string) => {
    try {
      await competitorContract?.call('insertIntoTable', [
        DEPRIZE_ID,
        teamId,
        '{}',
      ])
      toast.success('Joined as a competitor!', {
        style: toastStyle,
      })
      setJoinModalOpen(false)
      setTimeout(() => {
        refreshRewards()
      }, 5000)
    } catch (error) {
      console.error('Error joining as a competitor:', error)
      toast.error('Error joining as a competitor. Please try again.', {
        style: toastStyle,
      })
    }
  }
  return (
    <section id="rewards-container" className="overflow-hidden">
      <Head
        title="DePrize"
        description="Distribute rewards to contributors based on their contributions."
      />
      <Container>
        <ContentLayout
          header={'DePrize'}
          description="Distribute rewards to contributors based on their contributions."
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          {!isCompetitor && (
            <>
              <StandardButton
                onClick={() => setJoinModalOpen(true)}
                className="gradient-2 rounded-full"
              >
                Join
              </StandardButton>
              {joinModalOpen && (
                <JoinDePrizeModal
                  userTeams={userTeams}
                  setJoinModalOpen={setJoinModalOpen}
                  teamContract={teamContract}
                  handleJoinWithTeam={handleJoinWithTeam}
                />
              )}
            </>
          )}
          <section
            className={`w-full flex ${
              isMobile ? 'flex-col items-center' : 'flex-row items-start'
            }`}
          >
            <section
              className={`mt-8 flex flex-col ${isMobile ? '' : 'w-1/3'}`}
            >
              <h3 className="title-text-colors text-2xl font-GoodTimes">
                Total Q{quarter} Rewards
              </h3>
              <Asset
                name="PRIZE"
                amount={Number(prizeBudget.toPrecision(3)).toLocaleString()}
                usd={Number(
                  (prizeBudget * prizePrice).toPrecision(3)
                ).toLocaleString()}
              />
            </section>
            {userAddress && (
              <section
                className={`mt-8 flex flex-col px-4 ${isMobile ? '' : 'w-1/3'}`}
              >
                <h3 className="title-text-colors text-2xl font-GoodTimes">
                  Winner Prize
                </h3>
                <Asset
                  name="PRIZE"
                  amount={Number(winnerPool.toPrecision(3)).toLocaleString()}
                  usd=""
                />
              </section>
            )}
            {userAddress && (
              <section
                className={`mt-8 flex flex-col px-4 ${isMobile ? '' : 'w-1/3'}`}
              >
                <h3 className="title-text-colors text-2xl font-GoodTimes">
                  Voting Power
                </h3>
                <Asset name="PRIZE" amount={String(prizeBalance)} usd="" />
              </section>
            )}
          </section>
          <div className="pb-32 w-full flex flex-col gap-4 py-2">
            <div className="flex justify-between items-center">
              <h3 className="title-text-colors text-2xl font-GoodTimes">
                Competitors
              </h3>
            </div>
            <div>
              {competitors && (
                <Market
                  account={userAddress}
                  competitors={competitors}
                  teamContract={teamContract}
                />
              )}
            </div>
            {!userHasVotingPower && (
              <span>
                <StandardButton
                  link={`https://revnet.app/${chain.slug}/${PRIZE_REVNET_ID}`}
                  className="gradient-2 rounded-full"
                >
                  Get Voting Power
                </StandardButton>
              </span>
            )}
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
