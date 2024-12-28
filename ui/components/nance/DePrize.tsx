import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import CompetitorABI from 'const/abis/Competitor.json'
import ERC20 from 'const/abis/ERC20.json'
import REVDeployer from 'const/abis/REVDeployer.json'
import {
  DEPRIZE_ID,
  COMPETITOR_TABLE_ADDRESSES,
  REVNET_ADDRESSES,
} from 'const/config'
import { TEAM_ADDRESSES } from 'const/config'
import { useState, useContext } from 'react'
import toast from 'react-hot-toast'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import ChainContext from '@/lib/thirdweb/chain-context'
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

export type DePrizeProps = {
  competitors: Competitor[]
  refreshRewards: () => void
}

export function DePrize({ competitors, refreshRewards }: DePrizeProps) {
  const { selectedChain } = useContext(ChainContext)
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const userAddress = useAddress()

  const { contract: competitorContract } = useContract(
    COMPETITOR_TABLE_ADDRESSES[selectedChain.slug],
    CompetitorABI
  )
  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug]
  )

  const userTeams = useTeamWearer(teamContract, selectedChain, userAddress)

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
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
