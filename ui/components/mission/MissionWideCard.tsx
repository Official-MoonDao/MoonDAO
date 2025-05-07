import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { daysUntilDate } from '@/lib/utils/dates'
import { truncateTokenValue } from '@/lib/utils/numbers'
import StandardButton from '../layout/StandardButton'
import StandardWideCard from '../layout/StandardWideCard'
import { Mission } from './MissionCard'
import MissionFundingProgressBar from './MissionFundingProgressBar'
import MissionPayRedeem from './MissionPayRedeem'
import MissionStat from './MissionStat'

export type MissionWideCardProps = {
  mission: Mission
  token: any
  subgraphData: any
  fundingGoal: number
  contribute?: boolean
  stage?: number
  ruleset?: any
  missionImage?: File | string
  teamContract?: any
  selectedChain?: any
  jbDirectoryContract?: any
  editable?: boolean
  showMore?: boolean
  showMoreButton?: boolean
  learnMore?: boolean
  linkToMission?: boolean
  primaryTerminalAddress?: string
  compact?: boolean
  onClick?: () => void
}

export default function MissionWideCard({
  mission,
  token,
  ruleset,
  stage,
  subgraphData,
  fundingGoal,
  missionImage,
  contribute,
  selectedChain,
  teamContract,
  showMore,
  showMoreButton = true,
  learnMore,
  linkToMission,
  primaryTerminalAddress,
  compact,
  onClick,
}: MissionWideCardProps) {
  const router = useRouter()
  const [payModalEnabled, setPayModalEnabled] = useState(false)
  const [teamNFT, setTeamNFT] = useState<any>(null)

  const duration = useMemo(() => {
    return daysUntilDate(
      new Date(ruleset?.[0]?.start * 1000 + 28 * 24 * 60 * 60 * 1000)
    )
  }, [ruleset])

  useEffect(() => {
    async function getTeamNFT() {
      const teamNFT = await getNFT({
        contract: teamContract,
        tokenId: BigInt(mission?.teamId),
      })
      setTeamNFT(teamNFT)
    }

    if (teamContract && mission?.teamId !== undefined) getTeamNFT()
  }, [teamContract, mission?.teamId])

  return (
    <>
      {contribute && payModalEnabled && primaryTerminalAddress && (
        <div id="pay-modal">
          <MissionPayRedeem
            stage={stage}
            selectedChain={selectedChain}
            mission={mission}
            token={token}
            subgraphData={subgraphData}
            ruleset={ruleset}
            teamNFT={teamNFT}
            onlyModal
            modalEnabled={payModalEnabled}
            setModalEnabled={setPayModalEnabled}
            primaryTerminalAddress={primaryTerminalAddress}
            fundingGoal={fundingGoal}
          />
        </div>
      )}
      <StandardWideCard
        title={mission?.metadata?.name}
        subheader={mission?.metadata?.tagline}
        stats={
          <div className="w-full">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 justify-between">
              {duration && (
                <MissionStat
                  label="Deadline"
                  value={`${duration > 0 ? `${duration} days` : 'Expired'}`}
                  icon={'/assets/launchpad/clock.svg'}
                />
              )}
              {subgraphData?.volume !== undefined && (
                <MissionStat
                  label="Total Raised"
                  value={'Ξ ' + subgraphData.volume / 1e18}
                  icon={'/assets/launchpad/token.svg'}
                />
              )}
              {token?.tradeable !== undefined && (
                <MissionStat
                  icon="/assets/launchpad/token.svg"
                  label="Token"
                  value={token?.tradeable ? 'Yes' : 'No'}
                />
              )}
              <MissionStat
                icon="/assets/target.png"
                label="Goal"
                value={`${
                  fundingGoal
                    ? truncateTokenValue(fundingGoal / 1e18, 'ETH')
                    : 0
                } ETH`}
              />
            </div>
            <div className="mt-4 w-4/5">
              <MissionFundingProgressBar
                fundingGoal={fundingGoal || 0}
                volume={subgraphData?.volume / 1e18 || 0}
                compact={compact}
                stage={stage}
              />
            </div>
            {contribute && mission.projectId && (
              <StandardButton
                className="mt-4 gradient-2 rounded-full"
                hoverEffect={false}
                onClick={(e: any) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPayModalEnabled(true)
                }}
              >
                Contribute
              </StandardButton>
            )}
            {learnMore && (
              <StandardButton
                className="mt-4 gradient-2 rounded-full"
                hoverEffect={false}
                onClick={(e: any) => {
                  e.preventDefault()
                  e.stopPropagation()
                  router.push(`/mission/${mission.id}`)
                }}
              >
                Learn More
              </StandardButton>
            )}
          </div>
        }
        paragraph={
          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: mission?.metadata?.description || '',
            }}
          />
        }
        image={
          missionImage
            ? typeof missionImage === 'string'
              ? missionImage
              : URL.createObjectURL(missionImage)
            : getIPFSGateway(mission?.metadata?.logoUri)
        }
        showMore={showMore}
        showMoreButton={showMoreButton}
        onClick={() => {
          if (onClick) onClick()
          else if (linkToMission) router.push(`/mission/${mission.id}`)
        }}
        fullParagraph={!compact}
      />
    </>
  )
}
