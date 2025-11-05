import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { formatTimeUntilDeadline } from '@/lib/utils/dates'
import { truncateTokenValue } from '@/lib/utils/numbers'
import StandardButton from '../layout/StandardButton'
import StandardWideCard from '../layout/StandardWideCard'
import { Mission } from './MissionCard'
import MissionFundingProgressBar from './MissionFundingProgressBar'
import MissionStat from './MissionStat'

export type MissionWideCardProps = {
  mission: Mission
  token: any
  subgraphData?: any
  fundingGoal: number
  backers?: any[]
  contribute?: boolean
  stage?: number
  deadline?: number
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
  onlyGoalStat?: boolean
  youtubeVideo?: boolean
}

export default function MissionWideCard({
  mission,
  token,
  ruleset,
  stage,
  deadline,
  subgraphData,
  fundingGoal,
  backers,
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
  onlyGoalStat,
  youtubeVideo,
}: MissionWideCardProps) {
  const router = useRouter()
  const [payModalEnabled, setPayModalEnabled] = useState(false)
  const [teamNFT, setTeamNFT] = useState<any>(null)

  const { data: ethPrice } = useETHPrice(1)
  const { totalFunding } = useTotalFunding(mission?.projectId)

  const duration = useMemo(() => {
    return deadline ? formatTimeUntilDeadline(new Date(deadline)) : undefined
  }, [deadline])

  useEffect(() => {
    async function getTeamNFT() {
      try {
        const teamNFT = await getNFT({
          contract: teamContract,
          tokenId: BigInt(mission?.teamId),
        })
        setTeamNFT(teamNFT)
      } catch (error) {
        console.error('Error fetching team NFT:', error)
        setTeamNFT(null)
      }
    }

    if (
      teamContract &&
      mission?.teamId !== undefined &&
      mission?.teamId !== null
    )
      getTeamNFT()
  }, [teamContract, mission?.teamId])

  return (
    <>
      <StandardWideCard
        title={mission?.metadata?.name}
        subheader={mission?.metadata?.tagline}
        stats={
          <div className="w-full flex flex-col">
            <div className="w-full grid grid-cols-1 md:grid-cols-3  items-center">
              <div className="w-full flex flex-col gap-4 col-span-3">
                {ethPrice && subgraphData?.volume > 0 && (
                  <div className="bg-gradient-to-r from-[#51285C] to-[#6D3F79] text-white font-GoodTimes py-2 px-6 rounded-full inline-flex items-start w-fit flex-col">
                    <div className="flex items-center md:min-w-[200px]">
                      <Image
                        src="/assets/icon-raised-tokens.svg"
                        alt="Raised"
                        width={24}
                        height={24}
                        className="mr-2"
                      />
                      <span className="mr-2">
                        {truncateTokenValue(
                          Number(totalFunding || 0) / 1e18,
                          'ETH'
                        )}
                      </span>
                      <span className="text-sm md:text-base">ETH RAISED</span>
                    </div>
                    <p className="font-[Lato] text-sm opacity-60">{`($${Math.round(
                      (Number(totalFunding || 0) / 1e18) * ethPrice
                    ).toLocaleString()} USD)`}</p>
                  </div>
                )}
                {!onlyGoalStat && stage !== 3 && (
                  <div className="w-full">
                    <MissionFundingProgressBar
                      fundingGoal={fundingGoal || 0}
                      volume={subgraphData?.volume / 1e18 || 0}
                      compact={compact}
                    />
                  </div>
                )}
              </div>

              <div />
            </div>
            <div className="mt-4 w-full grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className={`col-span-2`}>
                <MissionStat
                  icon="/assets/target.png"
                  label="Goal"
                  value={`${
                    fundingGoal
                      ? truncateTokenValue(fundingGoal / 1e18, 'ETH')
                      : 0
                  } ETH`}
                  tooltip={`~ $${Math.round(
                    (fundingGoal / 1e18) * ethPrice
                  ).toLocaleString()} USD`}
                />
              </div>
              <div className="col-span-2">
                {duration && (
                  <MissionStat
                    label={duration === 'PASSED' ? 'Status' : 'Deadline'}
                    value={
                      duration === 'PASSED' && stage === 3
                        ? 'Refunded'
                        : duration === 'PASSED'
                        ? 'Launched'
                        : duration
                    }
                    icon={
                      duration === 'PASSED'
                        ? '/assets/launchpad/status-icon.svg'
                        : '/assets/launchpad/clock.svg'
                    }
                  />
                )}
              </div>
              {!onlyGoalStat && backers && (
                <MissionStat
                  label="Backers"
                  value={backers?.length || 0}
                  icon="/assets/icon-backers.svg"
                />
              )}
              {learnMore && (
                <StandardButton
                  className={`gradient-2 rounded-full ${
                    stage === 3 ? 'min-w-[225px]' : ''
                  }`}
                  hoverEffect={false}
                  onClick={(e: any) => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push(`/mission/${mission.id}`)
                  }}
                >
                  {stage === 3 ? 'Redemptions Available' : 'Learn More'}
                </StandardButton>
              )}
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
          </div>
        }
        paragraph={
          <div
            className="prose prose-invert max-w-none px-8 pb-12 md:pb-0 md:px-0"
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
        secondaryImage={getIPFSGateway(teamNFT?.metadata?.image)}
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
