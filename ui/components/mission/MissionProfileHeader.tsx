import { PencilIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import {
  getMissionMinimumUsdGoal,
  getMissionOffChainCommittedUsd,
  MISSION_FUNDING_MILESTONES_USD,
  MISSION_MINIMUM_GOAL_TOOLTIP,
} from 'const/missionMilestones'
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
import {
  jbSubgraphVolumeToBigIntWei,
  weiBigintToEthNumber,
} from '@/lib/mission/useMissionRaisedProgress'
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
  refundPeriod: number | undefined
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
    refundPeriod,
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

    /** Mission 4 (Frank's Overview Flight) gets a special header layout where
     *  the title + tagline span the full content width, with the image and
     *  funding card sitting side-by-side underneath. Other missions keep the
     *  original side-by-side title/image arrangement. */
    const isOverviewMission =
      mission?.id === 4 || String(mission?.id) === '4'

    const titleBlock = (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          {mission?.metadata?.name && (
            <MissionSingleLineTitle
              text={mission.metadata.name}
              minPx={22}
              // Allow the title to scale up when it has the full content
              // width to itself (Overview Mission layout); cap at the
              // standard size otherwise.
              maxPx={isOverviewMission ? 64 : 42}
              data-testid="mission-profile-title"
            />
          )}
          {isManager && setMissionMetadataModalEnabled && (
            <button
              className="shrink-0 mt-1 p-2 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl transition-all duration-200 border border-white/10 hover:border-white/20"
              onClick={() => setMissionMetadataModalEnabled(true)}
              title="Edit Mission"
            >
              <PencilIcon width={16} height={16} className="text-white/70 hover:text-white" />
            </button>
          )}
        </div>
        {mission?.metadata?.tagline && (
          <p
            className={
              isOverviewMission
                ? 'text-base sm:text-lg md:text-xl text-gray-300 leading-relaxed max-w-3xl'
                : 'text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl'
            }
          >
            {mission.metadata.tagline}
          </p>
        )}
        {/* Team Attribution sits with the title in the Overview layout so it
            reads as part of the full-width header block. */}
        {isOverviewMission && ruleset && teamNFT?.metadata?.name && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 pt-1">
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
      </div>
    )

    /** The Overview Mission's artwork is essentially square, so stretching it
     *  to fill the funding card's height on `lg+` (the default behaviour) was
     *  cropping the top and bottom via `object-cover`. For mission 4 we lock
     *  the image to `aspect-square` at every breakpoint and bound it with a
     *  `max-w` so it stays roughly the same height as the funding card on
     *  wide screens (instead of becoming a giant 720px square). We also
     *  switch to `object-contain` so any minor source-aspect mismatch shows
     *  thin matching-color letterboxing instead of cropping subject matter.
     *
     *  Other missions keep the existing fill-to-match behaviour so wider
     *  mission images can still match the copy column. */
    const imageAspectClass = isOverviewMission
      ? // square at every breakpoint; bounded so it doesn't dwarf the
        // funding card on lg+. mx-auto centers within the wider 3fr column.
        'aspect-square w-full max-w-[520px] mx-auto'
      : 'aspect-square lg:aspect-auto lg:h-full lg:min-h-[260px] w-full'
    const imageWrapperClass = isOverviewMission
      ? 'w-full min-w-0 flex flex-col self-start'
      : 'w-full min-w-0 lg:h-full lg:min-h-0 flex flex-col'
    const imageObjectFitClass = isOverviewMission
      ? // matches the page bg so any letterbox bars look intentional, not boxed
        'object-contain bg-[#090d21]'
      : 'object-cover'

    const imageBlock = (
      <div className={imageWrapperClass}>
        <div className="relative group w-full flex-1 min-h-0">
          {mission?.metadata?.logoUri ? (
            <div
              className={`relative ${imageAspectClass} rounded-2xl shadow-2xl border border-white/10 overflow-hidden`}
            >
              <IPFSRenderer
                src={mission?.metadata?.logoUri}
                fillContainer
                className={`${imageObjectFitClass} transition-transform duration-500 group-hover:scale-[1.02]`}
                height={640}
                width={640}
                alt="Mission Image"
                sizes="(max-width: 1024px) 100vw, 520px"
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
            <div
              className={`${imageAspectClass} rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl`}
            >
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
    )

    return (
      <div className="w-full bg-[#090d21] relative">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 w-full px-5 md:px-8 lg:px-12 pt-6 pb-4 lg:pt-8 lg:pb-6">
          <div
            className={`w-full max-w-[1200px] mx-auto ${
              isOverviewMission
                ? // Overview Mission layout: title spans full width up top,
                //   then image + funding card side-by-side below.
                  'flex flex-col gap-6 lg:gap-8'
                : ''
            }`}
          >
            {isOverviewMission && titleBlock}
            <div
              className={`w-full grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-10 items-start lg:items-stretch ${
                isOverviewMission ? '' : 'max-w-[1200px] mx-auto'
              }`}
            >
              {/* Mission image — square on mobile; on lg stretches to match copy column height (object-cover) */}
              {imageBlock}

              {/* Mission copy + funding (same column width as image on lg) */}
              <div className="flex flex-col justify-center lg:justify-start min-w-0 mt-1 lg:mt-0 lg:h-full lg:min-h-0 space-y-4">
                {/* Title & Tagline (only in the default layout — the Overview
                    layout renders these full-width above this grid). */}
                {!isOverviewMission && titleBlock}

                {/* Team Attribution (only in the default layout — Overview puts
                    this with the title block). */}
                {!isOverviewMission && ruleset && teamNFT?.metadata?.name && (
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
                <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-3 sm:p-5 border border-white/[0.06] w-full">
                {/* Amount Raised + CTA Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div className="min-w-0 w-full sm:w-auto">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {isLoadingTotalFunding || !ethPrice || ethPrice <= 0 ? (
                        <TextSkeleton width="w-24" height="h-8" />
                      ) : (
                        <span className="text-2xl sm:text-3xl font-GoodTimes text-white">
                          {`$${Math.round(onChainEthRaised * ethPrice + offChainCommittedUsd).toLocaleString()}`}
                        </span>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-indigo-400 uppercase tracking-wider">
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
                        {deadlinePassed && Number(stage) !== 3 && (
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
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 min-w-0">
                      <Image src="/assets/launchpad/target.svg" alt="Goal" width={14} height={14} className="opacity-60 flex-shrink-0" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">Goal</span>
                      <span className="flex-shrink-0">
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
                      </span>
                    </div>
                    {minUsdGoal != null ? (
                      <p className="text-white font-GoodTimes text-[11px] sm:text-sm truncate">
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
                        <p className="text-white font-GoodTimes text-[11px] sm:text-sm truncate">
                          {+(fundingGoal / 1e18).toFixed(3)} ETH
                        </p>
                      </Tooltip>
                    )}
                  </div>

                  {/* Deadline */}
                  <div className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 min-w-0">
                      <Image src="/assets/launchpad/clock.svg" alt="Deadline" width={14} height={14} className="opacity-60 flex-shrink-0" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">
                        {refundPeriodPassed || Number(stage) === 3
                          ? 'Status'
                          : deadlinePassed
                          ? 'Closed'
                          : 'Deadline'}
                      </span>
                      {deadline != null && deadline > 0 ? (
                        <span className="flex-shrink-0">
                          <Tooltip
                            text={exactClosingTooltipText(deadline)}
                            compact
                            buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                          >
                            ?
                          </Tooltip>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-white font-GoodTimes text-[10px] sm:text-sm break-words leading-tight">
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
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 min-w-0">
                      <Image src="/assets/icon-backers.svg" alt="Contributions" width={14} height={14} className="opacity-60 flex-shrink-0" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">
                        Contributions
                      </span>
                    </div>
                    <p className="text-white font-GoodTimes text-[11px] sm:text-sm">
                      {paymentsCount || 0}
                    </p>
                  </div>
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
