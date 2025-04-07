import { PencilIcon } from '@heroicons/react/24/outline'
import { BigNumber } from 'ethers'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
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
  ruleset?: any
  missionImage?: File
  teamContract?: any
  selectedChain?: any
  jbDirectoryContract?: any
  editable?: boolean
  showMore?: boolean
  linkToMission?: boolean
  primaryTerminalAddress?: string
  compact?: boolean
  onClick?: () => void
}

export default function MissionWideCard({
  mission,
  token,
  ruleset,
  subgraphData,
  fundingGoal,
  missionImage,
  contribute,
  selectedChain,
  teamContract,
  jbDirectoryContract,
  editable,
  showMore,
  linkToMission,
  primaryTerminalAddress,
  compact,
  onClick,
}: MissionWideCardProps) {
  const router = useRouter()
  const [payModalEnabled, setPayModalEnabled] = useState(false)
  const [teamNFT, setTeamNFT] = useState<any>(null)

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
        <MissionPayRedeem
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
      )}
      <StandardWideCard
        title={
          <div className="flex items-start justify-between gap-4">
            {mission?.metadata?.name}
          </div>
        }
        subheader={mission?.metadata?.tagline}
        stats={
          <div className="w-full">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-between">
              <MissionStat
                icon="/assets/target.png"
                label="Goal"
                value={`${
                  fundingGoal
                    ? truncateTokenValue(fundingGoal / 1e18, 'ETH')
                    : 0
                } ETH`}
              />
              {token?.tradeable !== undefined && (
                <MissionStat
                  icon="/assets/launchpad/token.svg"
                  label="Token"
                  value={token?.tradeable ? 'Yes' : 'No'}
                />
              )}
              {token?.tokenAddress && (
                <Link
                  href={`https://${
                    process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                      ? 'arbiscan.io'
                      : 'sepolia.etherscan.io'
                  }/token/${token?.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MissionStat
                    icon="/assets/launchpad/token.svg"
                    label="Token"
                    value={`$${token?.tokenSymbol} (${token?.tokenName})`}
                  />
                </Link>
              )}
              {subgraphData?.volume !== undefined && (
                <MissionStat
                  label="VOLUME"
                  value={'Ξ ' + subgraphData.volume / 1e18}
                />
              )}
              {subgraphData?.paymentsCount !== undefined && (
                <MissionStat
                  label="PAYMENTS"
                  value={subgraphData.paymentsCount}
                />
              )}
              {contribute && mission.projectId && (
                <StandardButton
                  className="gradient-2 rounded-full"
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
            <div className="mt-4 max-w-full">
              {subgraphData?.volume && fundingGoal && (
                <MissionFundingProgressBar
                  fundingGoal={fundingGoal}
                  volume={subgraphData.volume / 1e18}
                  compact={compact}
                />
              )}
            </div>
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
            ? URL.createObjectURL(missionImage)
            : mission?.metadata?.logoUri
        }
        showMore={showMore}
        onClick={() => {
          if (onClick) onClick()
          else if (linkToMission) router.push(`/mission/${mission.id}`)
        }}
        fullParagraph={!compact}
      />
    </>
  )
}
