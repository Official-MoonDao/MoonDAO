import { PencilIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import {
  getMissionMinimumUsdGoal,
  getMissionOffChainCommittedUsd,
  MISSION_FUNDING_MILESTONES_USD,
  MISSION_MINIMUM_GOAL_TOOLTIP,
} from 'const/missionMilestones'
import { formatUnits } from 'ethers/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import React, { useMemo } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { truncateTokenValue } from '@/lib/utils/numbers'
import IPFSRenderer from '../layout/IPFSRenderer'
import StandardButton from '../layout/StandardButton'
import Tooltip from '../layout/Tooltip'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { formatUsdCompact, milestoneSegmentProgress } from '@/lib/mission/milestoneProgress'
import MissionFundingMilestonesList from './MissionFundingMilestonesList'
import MissionFundingProgressBar from './MissionFundingProgressBar'
import MissionSingleLineTitle from './MissionSingleLineTitle'

// Loading skeleton components
const TextSkeleton = ({
  width,
  height = 'h-4',
}: {
  width: string
  height?: string
}) => <div className={`animate-pulse bg-gray-300 rounded ${height} ${width}`} />

/** Juicebox subgraph `volume` is string | number; cumulative pay-in wei. */
function jbSubgraphVolumeToBigIntWei(volume: unknown): bigint {
  if (volume == null || volume === '') return BigInt(0)
  try {
    const s =
      typeof volume === 'bigint'
        ? volume.toString()
        : String(volume).trim().split(/[.eE]/)[0]
    if (!/^\d+$/.test(s)) return BigInt(0)
    return BigInt(s)
  } catch {
    return BigInt(0)
  }
}

function weiBigintToEthNumber(wei: bigint): number {
  if (wei === BigInt(0)) return 0
  return parseFloat(formatUnits(wei.toString(), 18))
}

function exactClosingTooltipText(deadline: number | undefined): string {
  if (deadline == null || deadline === 0) {
    return 'No closing date is set for this mission.'
  }
  return `Exact closing (UTC): ${new Date(deadline).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  })}`
}

interface MissionProfileHeaderProps {
  mission: any
  teamNFT: any
  ruleset: any
  fundingGoal: number
  paymentsCount: number
  deadline: number | undefined
  duration: any
  deadlinePassed: boolean
  refundPeriodPassed: boolean
  stage: number
  token: any
  poolDeployerAddress: string | undefined
  isManager: boolean
  availableTokens: number
  availablePayouts: number
  sendReservedTokens: () => void
  sendPayouts: () => void
  deployLiquidityPool: () => void
  totalFunding: bigint
  /** Subgraph cumulative native volume (wei); terminal balance alone can read 0 after payouts. */
  subgraphVolume?: unknown
  isLoadingTotalFunding: boolean
  setMissionMetadataModalEnabled?: (enabled: boolean) => void
  setDeployTokenModalEnabled?: (enabled: boolean) => void
  contributeButton: React.ReactNode
}

const MissionProfileHeader = React.memo(
  ({
    mission,
    teamNFT,
    ruleset,
    fundingGoal,
    paymentsCount,
    deadline,
    duration,
    deadlinePassed,
    refundPeriodPassed,
    stage,
    token,
    poolDeployerAddress,
    isManager,
    availableTokens,
    availablePayouts,
    sendReservedTokens,
    sendPayouts,
    deployLiquidityPool,
    totalFunding,
    subgraphVolume,
    isLoadingTotalFunding,
    setMissionMetadataModalEnabled,
    setDeployTokenModalEnabled,
    contributeButton,
  }: MissionProfileHeaderProps) => {
    const account = useActiveAccount()
    const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

    const minUsdGoal = getMissionMinimumUsdGoal(mission?.id)
    const offChainCommittedUsd = getMissionOffChainCommittedUsd(mission?.id)
    const terminalWei = totalFunding ?? BigInt(0)
    const subgraphWei = jbSubgraphVolumeToBigIntWei(subgraphVolume)
    const onChainRaisedWei = terminalWei >= subgraphWei ? terminalWei : subgraphWei
    const onChainEthRaised = weiBigintToEthNumber(onChainRaisedWei)

    const milestoneBar = useMemo(() => {
      const steps =
        mission?.id != null ? MISSION_FUNDING_MILESTONES_USD[mission.id] : undefined
      if (!steps?.length || !ethPrice || ethPrice <= 0 || isLoadingTotalFunding) return null
      const raisedUsd = onChainEthRaised * ethPrice + offChainCommittedUsd
      const seg = milestoneSegmentProgress(raisedUsd, steps)
      const caption = seg.allMilestonesComplete
        ? 'All milestones below are unlocked. Funding continues toward the full campaign goal.'
        : `Toward the ${formatUsdCompact(seg.segmentEndUsd)} milestone · ${formatUsdCompact(
            Math.max(0, seg.segmentEndUsd - raisedUsd)
          )} to go`
      return { seg, raisedUsd, steps, caption }
    }, [
      mission?.id,
      ethPrice,
      isLoadingTotalFunding,
      onChainEthRaised,
      offChainCommittedUsd,
    ])

    return (
      <div className="w-full bg-[#090d21] relative overflow-hidden">
        {/* Edit Button for Managers */}
        {isManager && setMissionMetadataModalEnabled && (
          <button
            className="absolute top-5 right-6 z-20 p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl transition-all duration-200 border border-white/10 hover:border-white/20"
            onClick={() => setMissionMetadataModalEnabled(true)}
            title="Edit Mission"
          >
            <PencilIcon width={18} height={18} className="text-white/70 hover:text-white" />
          </button>
        )}

        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 w-full px-5 md:px-8 lg:px-12 pt-6 pb-4 lg:pt-8 lg:pb-6">
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start lg:items-center max-w-[1200px] mx-auto">
            {/* Mission image — full grid cell width at every breakpoint (no mobile max-w shrink) */}
            <div className="w-full min-w-0">
              <div className="relative group w-full">
                {mission?.metadata?.logoUri ? (
                  <div className="relative aspect-square w-full rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                    <IPFSRenderer
                      src={mission?.metadata?.logoUri}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      height={640}
                      width={640}
                      alt="Mission Image"
                    />
                    {teamNFT?.metadata?.image && (
                      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
                        <IPFSRenderer
                          src={teamNFT?.metadata?.image}
                          className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full border-2 border-[#090d21] shadow-lg ring-2 ring-white/10"
                          height={72}
                          width={72}
                          alt="Team Image"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square w-full rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl">
                    <div className="text-center px-4">
                      <div className="w-12 h-12 mx-auto mb-3 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Image src="/assets/icon-star-blue.svg" alt="Mission" width={24} height={24} />
                      </div>
                      <p className="text-gray-500 text-sm">Mission Image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mission copy + funding (same column width as image on lg) */}
            <div className="flex flex-col justify-center min-w-0 mt-1 lg:mt-0 space-y-4">
              {/* Title & Tagline */}
              <div className="space-y-2">
                {mission?.metadata?.name && (
                  <MissionSingleLineTitle
                    text={mission.metadata.name}
                    minPx={22}
                    maxPx={42}
                    data-testid="mission-profile-title"
                  />
                )}
                {mission?.metadata?.tagline && (
                  <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl">
                    {mission.metadata.tagline}
                  </p>
                )}
              </div>

              {/* Team Attribution */}
              {ruleset && teamNFT?.metadata?.name && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
                  <span>
                    Launched{' '}
                    {new Date(ruleset?.[0]?.start * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span>·</span>
                  <Link
                    href={`/team/${generatePrettyLink(teamNFT?.metadata?.name)}`}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
                  >
                    {teamNFT?.metadata?.name}
                  </Link>
                </div>
              )}

              {/* Funding Card */}
              <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-5 border border-white/[0.06] w-full">
                {/* Amount Raised + CTA Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {isLoadingTotalFunding || !ethPrice || ethPrice <= 0 ? (
                        <TextSkeleton width="w-24" height="h-8" />
                      ) : (
                        <span className="text-3xl font-GoodTimes text-white">
                          {`$${Math.round(onChainEthRaised * ethPrice + offChainCommittedUsd).toLocaleString()}`}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-indigo-400 uppercase tracking-wider">
                          raised
                        </span>
                        <Tooltip
                          compact
                          text={
                            isLoadingTotalFunding
                              ? 'Loading...'
                              : offChainCommittedUsd > 0
                              ? `The total includes both on-chain and off-chain committed funds. On-chain: ${truncateTokenValue(onChainEthRaised, 'ETH')} ETH (about $${Math.round(onChainEthRaised * ethPrice).toLocaleString()} at the current ETH price). Off-chain committed: $${offChainCommittedUsd.toLocaleString()}.`
                              : `${truncateTokenValue(onChainEthRaised, 'ETH').toLocaleString()} ETH has been raised. The USD equivalent fluctuates based on the current price of Ethereum.`
                          }
                          buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                        >
                          ?
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch sm:items-end gap-2">
                    {contributeButton}
                    {/* Manager Actions */}
                    {account && isManager && (
                      <div className="flex flex-wrap gap-2">
                        {deadlinePassed && (
                          <>
                            <PrivyWeb3Button
                              requiredChain={DEFAULT_CHAIN_V5}
                              className="group bg-white/5 hover:bg-indigo-500/10 text-white py-1.5 px-3 rounded-lg transition-all duration-200 border border-white/10 hover:border-indigo-400/30 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                              label={
                                <div className="flex items-center gap-1.5">
                                  <Image src="/assets/icon-raised-tokens.svg" alt="Tokens" width={12} height={12} className="opacity-60 group-hover:opacity-100" />
                                  <span>Tokens</span>
                                </div>
                              }
                              action={sendReservedTokens}
                              isDisabled={!availableTokens}
                            />
                            <PrivyWeb3Button
                              requiredChain={DEFAULT_CHAIN_V5}
                              className="group bg-white/5 hover:bg-blue-500/10 text-white py-1.5 px-3 rounded-lg transition-all duration-200 border border-white/10 hover:border-blue-400/30 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                              label={
                                <div className="flex items-center gap-1.5">
                                  <Image src="/assets/icon-crowdfunding.svg" alt="Payouts" width={12} height={12} className="opacity-60 group-hover:opacity-100" />
                                  <span>Payouts</span>
                                </div>
                              }
                              action={sendPayouts}
                              isDisabled={!availablePayouts}
                            />
                            {stage === 2 && (
                              <PrivyWeb3Button
                                requiredChain={DEFAULT_CHAIN_V5}
                                className="group bg-white/5 hover:bg-emerald-500/10 text-white py-1.5 px-3 rounded-lg transition-all duration-200 border border-white/10 hover:border-emerald-400/30 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                                label={
                                  <div className="flex items-center gap-1.5">
                                    <Image src="/assets/icon-ethereum.svg" alt="Liquidity" width={12} height={12} className="opacity-60 group-hover:opacity-100" />
                                    <span>Liquidity</span>
                                  </div>
                                }
                                action={deployLiquidityPool}
                                isDisabled={!poolDeployerAddress}
                              />
                            )}
                          </>
                        )}
                        {setDeployTokenModalEnabled && !token?.tokenAddress && (
                          <StandardButton
                            id="deploy-token-button"
                            className="bg-white/5 hover:bg-indigo-500/10 text-white py-1.5 px-3 rounded-lg transition-all duration-200 border border-white/10 hover:border-indigo-400/30 text-xs"
                            borderRadius="rounded-lg"
                            onClick={() => setDeployTokenModalEnabled(true)}
                          >
                            Deploy Token
                          </StandardButton>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar (milestone-relative for missions with USD steps, e.g. Frank White / id 4) */}
                <div className="mb-4">
                  <MissionFundingProgressBar
                    fundingGoal={fundingGoal}
                    volume={onChainEthRaised}
                    compact={true}
                    progressOverride={
                      milestoneBar ? milestoneBar.seg.progressPercent : undefined
                    }
                    caption={milestoneBar?.caption}
                  />
                  {milestoneBar ? (
                    <MissionFundingMilestonesList
                      milestones={milestoneBar.steps}
                      raisedUsd={milestoneBar.raisedUsd}
                      nextMilestoneIndex={milestoneBar.seg.nextMilestoneIndex}
                    />
                  ) : null}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Goal */}
                  <div className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Image src="/assets/launchpad/target.svg" alt="Goal" width={14} height={14} className="opacity-60" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Goal</span>
                      <Tooltip
                        compact
                        text={
                          minUsdGoal != null
                            ? MISSION_MINIMUM_GOAL_TOOLTIP
                            : 'This is an all-or-nothing mission. Refunds are available if the goal is not met.'
                        }
                        buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                      >
                        ?
                      </Tooltip>
                    </div>
                    {minUsdGoal != null ? (
                      <p className="text-white font-GoodTimes text-sm">
                        ${minUsdGoal.toLocaleString('en-US')}
                      </p>
                    ) : (
                      <Tooltip
                        text={
                          !isLoadingTotalFunding && ethPrice && ethPrice > 0
                            ? `$${Math.round((fundingGoal / 1e18) * ethPrice).toLocaleString()}`
                            : `Loading...`
                        }
                        wrap
                      >
                        <p className="text-white font-GoodTimes text-sm">
                          {+(fundingGoal / 1e18).toFixed(3)} ETH
                        </p>
                      </Tooltip>
                    )}
                  </div>

                  {/* Deadline */}
                  <div className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Image src="/assets/launchpad/clock.svg" alt="Deadline" width={14} height={14} className="opacity-60" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">
                        {refundPeriodPassed || Number(stage) === 3
                          ? 'Status'
                          : deadlinePassed
                          ? 'Closed'
                          : 'Deadline'}
                      </span>
                      {deadline != null && deadline > 0 ? (
                        <Tooltip
                          text={exactClosingTooltipText(deadline)}
                          compact
                          buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                        >
                          ?
                        </Tooltip>
                      ) : null}
                    </div>
                    <p className="text-white font-GoodTimes text-xs sm:text-sm break-words">
                      {refundPeriodPassed || deadlinePassed
                        ? deadlinePassed
                          ? `${new Date(deadline || 0).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}`
                          : 'REFUNDED'
                        : Number(stage) === 3
                        ? 'REFUND'
                        : duration}
                    </p>
                  </div>

                  {/* Contributions */}
                  <div className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                      <Image src="/assets/icon-backers.svg" alt="Contributions" width={14} height={14} className="opacity-60 flex-shrink-0" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">
                        Contributions
                      </span>
                    </div>
                    <p className="text-white font-GoodTimes text-sm">
                      {paymentsCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

MissionProfileHeader.displayName = 'MissionProfileHeader'

export default MissionProfileHeader
