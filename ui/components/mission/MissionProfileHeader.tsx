import { PencilIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { truncateTokenValue } from '@/lib/utils/numbers'
import IPFSRenderer from '../layout/IPFSRenderer'
import StandardButton from '../layout/StandardButton'
import Tooltip from '../layout/Tooltip'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionFundingProgressBar from './MissionFundingProgressBar'

// Loading skeleton components
const TextSkeleton = ({
  width,
  height = 'h-4',
}: {
  width: string
  height?: string
}) => <div className={`animate-pulse bg-gray-300 rounded ${height} ${width}`} />

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
    isLoadingTotalFunding,
    setMissionMetadataModalEnabled,
    setDeployTokenModalEnabled,
    contributeButton,
  }: MissionProfileHeaderProps) => {
    const account = useActiveAccount()
    const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

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
          <div className="w-full flex flex-col lg:flex-row gap-8 lg:gap-10 items-center max-w-[1200px] mx-auto">
            {/* Left Column - Mission Image */}
            <div className="flex-shrink-0">
              <div className="relative group">
                {mission?.metadata?.logoUri ? (
                  <div className="relative">
                    <div className="relative w-64 h-64 sm:w-72 sm:h-72 lg:w-[300px] lg:h-[300px]">
                      <IPFSRenderer
                        src={mission?.metadata?.logoUri}
                        className="rounded-2xl shadow-2xl border border-white/10 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        height={300}
                        width={300}
                        alt="Mission Image"
                      />
                      {/* Team badge */}
                      {teamNFT?.metadata?.image && (
                        <div className="absolute -bottom-3 -right-3">
                          <IPFSRenderer
                            src={teamNFT?.metadata?.image}
                            className="w-14 h-14 lg:w-16 lg:h-16 rounded-full border-2 border-[#090d21] shadow-lg ring-2 ring-white/10"
                            height={64}
                            width={64}
                            alt="Team Image"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-64 h-64 sm:w-72 sm:h-72 lg:w-[300px] lg:h-[300px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Image src="/assets/icon-star-blue.svg" alt="Mission" width={24} height={24} />
                      </div>
                      <p className="text-gray-500 text-sm">Mission Image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Mission Info */}
            <div className="flex flex-col justify-center flex-grow min-w-0 mt-2 lg:mt-0 space-y-4">
              {/* Title & Tagline */}
              <div className="space-y-2">
                {mission?.metadata?.name && (
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-GoodTimes text-white leading-tight tracking-tight">
                    {mission.metadata.name}
                  </h1>
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
                    <Tooltip
                      text={
                        isLoadingTotalFunding
                          ? 'Loading...'
                          : `${truncateTokenValue(Number(totalFunding || 0) / 1e18 || 0, 'ETH').toLocaleString()} ETH`
                      }
                      wrap
                    >
                      <div className="flex items-baseline gap-2 cursor-default">
                        {isLoadingTotalFunding || !ethPrice || ethPrice <= 0 ? (
                          <TextSkeleton width="w-24" height="h-8" />
                        ) : (
                          <span className="text-3xl font-GoodTimes text-white">
                            {`$${Math.round((Number(totalFunding || 0) / 1e18 || 0) * ethPrice).toLocaleString()}`}
                          </span>
                        )}
                        <span className="text-sm font-medium text-indigo-400 uppercase tracking-wider">
                          raised
                        </span>
                      </div>
                    </Tooltip>
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

                {/* Progress Bar */}
                <div className="mb-4">
                  <MissionFundingProgressBar
                    fundingGoal={fundingGoal}
                    volume={Number(totalFunding || 0) / 1e18}
                    compact={true}
                  />
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Goal */}
                  <div className="bg-white/[0.03] rounded-xl p-2 sm:p-3 border border-white/[0.05] min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Image src="/assets/launchpad/target.svg" alt="Goal" width={14} height={14} className="opacity-60" />
                      <span className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Goal</span>
                      <Tooltip
                        text="This is an all-or-nothing mission. Refunds are available if the goal is not met."
                        buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 -ml-0.5"
                      >
                        ?
                      </Tooltip>
                    </div>
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
