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
import React, { useEffect, useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import type { MissionFundingStats } from '@/lib/mission/fetchMissionFundingStats'
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
import MissionDeadlineCountdown from './MissionDeadlineCountdown'
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
  /** SSR-aggregated funding stats (median contribution, unique backers,
   *  total contributions). Provided only for the wrapped-up Overview Flight
   *  mission (id 4); when present, the header swaps the live progress
   *  bar / milestones / goal tile for a "campaign success" stat row plus a
   *  30-day seat procurement countdown. */
  overviewStats?: MissionFundingStats | null
}

/** 30-day post-deadline window during which Frank's team works to convert
 *  contributions into an actual seat to space. After this period elapses,
 *  contributors become eligible for a refund if a seat couldn't be secured. */
const SEAT_PROCUREMENT_DAYS = 30
const SEAT_PROCUREMENT_MS = SEAT_PROCUREMENT_DAYS * 24 * 60 * 60 * 1000

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
    overviewStats,
  }: MissionProfileHeaderProps) => {
    const account = useActiveAccount()
    const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

    const minUsdGoal = getMissionMinimumUsdGoal(mission?.id)
    const offChainCommittedUsd = getMissionOffChainCommittedUsd(mission?.id)
    const terminalWei = totalFunding ?? BigInt(0)
    const subgraphWei = jbSubgraphVolumeToBigIntWei(subgraphVolume)
    const onChainRaisedWei = terminalWei >= subgraphWei ? terminalWei : subgraphWei
    const onChainEthRaised = weiBigintToEthNumber(onChainRaisedWei)

    /** Mission 4 (Frank's Overview Flight) gets a special header layout where
     *  the title + tagline span the full content width, with the image and
     *  funding card sitting side-by-side underneath. Other missions keep the
     *  original side-by-side title/image arrangement. */
    const isOverviewMission =
      mission?.id === 4 || String(mission?.id) === '4'

    const milestoneBar = useMemo(() => {
      // The Overview Flight raise is wrapped up — the funding card now
      // shows success stats + a seat procurement countdown instead of the
      // milestone progress bar / list. Skip the milestone computation for
      // mission 4 entirely so the bar/list never render even momentarily
      // (and `MISSION_FUNDING_MILESTONES_USD` can keep its mission-4 entry
      // for places like the home/featured sections that still want it).
      if (isOverviewMission) return null
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
      isOverviewMission,
      mission?.id,
      ethPrice,
      isLoadingTotalFunding,
      onChainEthRaised,
      offChainCommittedUsd,
    ])

    /** Now-anchored values for the seat procurement countdown. We avoid
     *  rendering anything until after the first client commit so the SSR
     *  HTML doesn't bake in a wall-clock that immediately disagrees with
     *  the user's local Date. */
    const [now, setNow] = useState<number | null>(null)
    useEffect(() => {
      if (!isOverviewMission || deadline == null || deadline <= 0) return
      setNow(Date.now())
      const id = window.setInterval(() => setNow(Date.now()), 60_000)
      return () => window.clearInterval(id)
    }, [isOverviewMission, deadline])

    const seatProcurement = useMemo(() => {
      if (!isOverviewMission || deadline == null || deadline <= 0) return null
      const procurementEndMs = deadline + SEAT_PROCUREMENT_MS
      const procurementEndDate = new Date(procurementEndMs)
      const procurementEndLabel = procurementEndDate.toLocaleDateString(
        'en-US',
        { month: 'long', day: 'numeric', year: 'numeric' }
      )
      const periodElapsed = now != null && now >= procurementEndMs
      let countdownLabel: string | null = null
      if (now != null && !periodElapsed) {
        const msLeft = Math.max(0, procurementEndMs - now)
        const totalMinutes = Math.floor(msLeft / 60_000)
        const days = Math.floor(totalMinutes / (60 * 24))
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
        const minutes = totalMinutes % 60
        countdownLabel =
          days >= 1
            ? `${days}d ${hours}h`
            : hours >= 1
            ? `${hours}h ${minutes}m`
            : `${minutes}m`
      }
      return {
        procurementEndMs,
        procurementEndLabel,
        periodElapsed,
        countdownLabel,
      }
    }, [isOverviewMission, deadline, now])

    const overviewMedianUsd = useMemo(() => {
      if (!overviewStats || !ethPrice || ethPrice <= 0) return null
      const wei = (() => {
        try {
          return BigInt(overviewStats.medianAmountWei || '0')
        } catch {
          return BigInt(0)
        }
      })()
      if (wei === BigInt(0)) return 0
      // Convert wei → ETH (float) → USD using the current ETH price. The
      // raise spanned a price range so this is an approximation, but it's
      // the same convention the headline "raised" number uses, which keeps
      // the on-page numbers internally consistent.
      const eth = Number(wei) / 1e18
      return eth * ethPrice
    }, [overviewStats, ethPrice])

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
     *  the image to `aspect-square` at every breakpoint and let it fill its
     *  column (the grid below splits 1:1 for Overview, so the column width
     *  ≈580px on a 1200px layout — the resulting square is balanced against
     *  the funding card height-wise). We use `object-contain` so any minor
     *  source-aspect mismatch shows thin matching-color letterboxing instead
     *  of cropping subject matter.
     *
     *  Other missions keep the existing fill-to-match behaviour so wider
     *  mission images can still match the copy column. */
    const imageAspectClass = isOverviewMission
      ? 'aspect-square w-full'
      : 'aspect-square lg:aspect-auto lg:h-full lg:min-h-[260px] w-full'
    const imageWrapperClass = isOverviewMission
      ? 'w-full min-w-0 flex flex-col'
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
                sizes="(max-width: 1024px) 100vw, 480px"
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
              className={`w-full grid grid-cols-1 gap-8 lg:gap-10 items-start lg:items-stretch ${
                isOverviewMission
                  ? // 2:3 split: shrinks the (square) artwork column so the
                    //   image height — which drives the row height — is
                    //   smaller, while the funding card claims more
                    //   horizontal real-estate. Net effect: less empty
                    //   vertical space inside the contribute card.
                    'lg:grid-cols-[2fr_3fr]'
                  : 'lg:grid-cols-[3fr_2fr] max-w-[1200px] mx-auto'
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

                {/* Funding Card. For the Overview Mission we stretch this
                    card to fill the full height of the row so its bottom
                    edge aligns with the square hero image. The content
                    inside stays top-aligned and the bottom (Stats Row) is
                    pushed to the card's bottom via mt-auto, which gives a
                    balanced look without big midsection gaps. */}
                <div
                  className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl p-3 sm:p-5 border border-white/[0.06] w-full ${
                    isOverviewMission
                      ? 'lg:flex-1 lg:min-h-0 lg:flex lg:flex-col'
                      : ''
                  }`}
                >
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

                {/* Progress Bar — hidden on the wrapped-up Overview Flight
                    page (mission 4). Other missions still get the live bar
                    + milestone list. */}
                {!isOverviewMission && (
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
                )}

                {/* Contributions-closed banner — Overview Flight only. Sits
                    directly above the Seat Procurement panel so the reader
                    immediately understands why the live progress / pay UI
                    is gone before reading about the 30-day refund window. */}
                {isOverviewMission && (
                  <div
                    data-testid="overview-contributions-closed-banner"
                    className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 flex items-start gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]"
                    />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold leading-snug">
                        Contributions are now closed
                      </p>
                      <p className="text-gray-400 text-xs sm:text-[13px] leading-relaxed mt-0.5">
                        The Overview Flight raise has wrapped up — no further
                        contributions are being accepted.
                      </p>
                    </div>
                  </div>
                )}

                {/* Seat Procurement Period — Overview Flight only. Replaces
                    the milestone progress UI now that the raise has wrapped
                    up. Anchored to the on-chain deadline, hydrated client
                    side so SSR doesn't bake a stale countdown into HTML. */}
                {isOverviewMission && seatProcurement && (
                  <div
                    data-testid="overview-seat-procurement-panel"
                    className="mb-4 rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-indigo-300/90">
                            Seat Procurement Period
                          </span>
                          <Tooltip
                            compact
                            text={`A ${SEAT_PROCUREMENT_DAYS}-day window (starting at the close of the raise) during which Frank's team works to convert raised funds into a confirmed seat to space. After this window closes, contributors become eligible for a refund if a seat could not be secured.`}
                            buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                          >
                            ?
                          </Tooltip>
                        </div>
                        <p className="text-white font-GoodTimes text-base sm:text-lg leading-tight mt-1">
                          {seatProcurement.periodElapsed
                            ? 'Period Closed'
                            : `Ends ${seatProcurement.procurementEndLabel}`}
                        </p>
                      </div>
                      {!seatProcurement.periodElapsed && (
                        <div className="text-right">
                          <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-gray-400">
                            Time Remaining
                          </span>
                          <p
                            data-testid="overview-seat-procurement-countdown"
                            className="text-white font-GoodTimes text-base sm:text-lg leading-tight mt-1"
                          >
                            {seatProcurement.countdownLabel ?? '\u2014'}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-300/90 text-xs sm:text-sm leading-relaxed mt-3">
                      {seatProcurement.periodElapsed
                        ? `The ${SEAT_PROCUREMENT_DAYS}-day seat procurement period has ended. If Frank is unable to secure a seat to space, contributors are eligible for a refund.`
                        : `Frank's team has ${SEAT_PROCUREMENT_DAYS} days from the close of the raise to secure a confirmed seat to space. Once this window ends, refunds will be made available if a seat cannot be secured.`}
                    </p>
                  </div>
                )}

                {/* Stats Row. On the Overview layout the funding card is
                    stretched to match the hero image; mt-auto pushes this
                    row to the card's bottom so the extra height shows up
                    as breathing room above the stats rather than a gap
                    below them.

                    Mission 4 (Overview Flight, wrapped up) swaps the Goal
                    tile for "Unique Backers" + "Median Contribution"
                    success metrics, drops the Deadline tile (the Seat
                    Procurement Period panel above already contains the
                    relevant date), and keeps the Contributions tile. */}
                <div
                  className={`grid gap-2 sm:gap-3 ${
                    isOverviewMission
                      ? 'grid-cols-3'
                      : 'grid-cols-3'
                  } ${isOverviewMission ? 'lg:mt-auto' : ''}`}
                  data-testid={
                    isOverviewMission ? 'overview-stats-row' : undefined
                  }
                >
                  {/* Goal — hidden on mission 4 (the page has been cleaned
                      up post-raise; goal/progress no longer relevant). */}
                  {!isOverviewMission && (
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
                  )}

                  {/* Deadline — hidden on mission 4 (the Seat Procurement
                      Period panel renders the relevant closing context). */}
                  {!isOverviewMission && (
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
                      {refundPeriodPassed || deadlinePassed ? (
                        <p className="text-white font-GoodTimes text-[10px] sm:text-sm break-words leading-tight">
                          {deadlinePassed
                            ? `${new Date(deadline || 0).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}`
                            : 'REFUNDED'}
                        </p>
                      ) : Number(stage) === 3 ? (
                        <p className="text-white font-GoodTimes text-[10px] sm:text-sm break-words leading-tight">
                          REFUND
                        </p>
                      ) : deadline != null && deadline > 0 ? (
                        <MissionDeadlineCountdown deadline={deadline} />
                      ) : (
                        <p className="text-white font-GoodTimes text-[10px] sm:text-sm break-words leading-tight">
                          {duration}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Contributions */}
                  <div className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 min-w-0">
                      <Image src="/assets/icon-backers.svg" alt="Contributions" width={14} height={14} className="opacity-60 flex-shrink-0" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">
                        Contributions
                      </span>
                    </div>
                    <p className="text-white font-GoodTimes text-[11px] sm:text-sm">
                      {(isOverviewMission && overviewStats?.totalContributions != null
                        ? overviewStats.totalContributions
                        : paymentsCount) || 0}
                    </p>
                  </div>

                  {/* Unique Backers — Overview Flight only */}
                  {isOverviewMission && (
                    <div
                      className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0"
                      data-testid="overview-unique-backers"
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 min-w-0">
                        <Image src="/assets/icon-backers.svg" alt="Unique backers" width={14} height={14} className="opacity-60 flex-shrink-0" />
                        <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">
                          Unique Backers
                        </span>
                        <span className="flex-shrink-0">
                          <Tooltip
                            compact
                            text="Distinct wallets that contributed to this raise (counted by pay-event beneficiary on the Juicebox subgraph)."
                            buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                          >
                            ?
                          </Tooltip>
                        </span>
                      </div>
                      <p className="text-white font-GoodTimes text-[11px] sm:text-sm">
                        {overviewStats?.uniqueBackers != null
                          ? overviewStats.uniqueBackers.toLocaleString('en-US')
                          : '—'}
                      </p>
                    </div>
                  )}

                  {/* Median Contribution — Overview Flight only */}
                  {isOverviewMission && (
                    <div
                      className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0"
                      data-testid="overview-median-contribution"
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 min-w-0">
                        <Image src="/assets/launchpad/target.svg" alt="Median" width={14} height={14} className="opacity-60 flex-shrink-0" />
                        <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium truncate">
                          Median Contribution
                        </span>
                        <span className="flex-shrink-0">
                          <Tooltip
                            compact
                            text="Median on-chain pay event amount. Converted to USD using the current ETH/USD rate, so it's an approximation across the raise's price range."
                            buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                          >
                            ?
                          </Tooltip>
                        </span>
                      </div>
                      {overviewMedianUsd == null ? (
                        <p className="text-white font-GoodTimes text-[11px] sm:text-sm">—</p>
                      ) : overviewMedianUsd <= 0 ? (
                        <p className="text-white font-GoodTimes text-[11px] sm:text-sm">$0</p>
                      ) : overviewMedianUsd >= 1 ? (
                        <p className="text-white font-GoodTimes text-[11px] sm:text-sm">
                          ${Math.round(overviewMedianUsd).toLocaleString('en-US')}
                        </p>
                      ) : (
                        <p className="text-white font-GoodTimes text-[11px] sm:text-sm">
                          ${overviewMedianUsd.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
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
