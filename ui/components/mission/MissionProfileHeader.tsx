import { PencilIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { truncateTokenValue } from '@/lib/utils/numbers'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import IPFSRenderer from '../layout/IPFSRenderer'
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
  backers: any[]
  deadline: number | undefined
  duration: any
  deadlinePassed: boolean
  refundPeriodPassed: boolean
  stage: number
  poolDeployerAddress: string | undefined
  isManager: boolean
  availableTokens: number
  availablePayouts: number
  sendReservedTokens: () => void
  sendPayouts: () => void
  deployLiquidityPool: () => void
  // Direct props for total funding instead of callback
  totalFunding: bigint
  isLoadingTotalFunding: boolean
  setMissionMetadataModalEnabled?: (enabled: boolean) => void
  contributeButton: React.ReactNode
}

const MissionProfileHeader = React.memo(
  ({
    mission,
    teamNFT,
    ruleset,
    fundingGoal,
    backers,
    deadline,
    duration,
    deadlinePassed,
    refundPeriodPassed,
    stage,
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
    contributeButton,
  }: MissionProfileHeaderProps) => {
    const account = useActiveAccount()
    const { data: ethPrice, isLoading: isLoadingEthPrice } = useETHPrice(
      1,
      'ETH_TO_USD'
    )

    // Total funding is now passed as props from MissionProfile component

    return (
      <div className="w-full bg-[#090d21] relative overflow-hidden">
        {/* Edit Button for Managers */}
        {isManager && setMissionMetadataModalEnabled && (
          <button
            className="absolute top-6 right-24 z-20 p-2 bg-slate-600/50 hover:bg-slate-500/50 rounded-xl transition-colors"
            onClick={() => setMissionMetadataModalEnabled(true)}
          >
            <PencilIcon width={24} height={24} className="text-white" />
          </button>
        )}

        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.1),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.05),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 w-full px-[5vw] pt-4 pb-2 lg:pt-6 lg:pb-3">
          <div className="flex flex-col lg:flex-row gap-x-8 items-center max-w-[1200px] xl:min-w-[1200px] mx-auto">
            {/* Left Column - Mission Image */}
            <div className="flex justify-center lg:justify-start">
              <div className="relative group">
                {mission?.metadata?.logoUri ? (
                  <div className="relative">
                    {/* Main mission image with enhanced styling */}
                    <div className="relative w-full max-w-xs sm:w-80 sm:h-80 lg:w-[320px] lg:h-[320px] aspect-square">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-400/15 to-blue-400/15 rounded-2xl blur-xl group-hover:blur-lg transition-all duration-500" />
                      <IPFSRenderer
                        src={mission?.metadata?.logoUri}
                        className="relative rounded-2xl shadow-xl border border-white/10 group-hover:shadow-purple-500/20 transition-all duration-500 w-full h-full object-cover"
                        height={320}
                        width={320}
                        alt="Mission Image"
                      />

                      {/* Floating team NFT badge */}
                      {teamNFT?.metadata?.image && (
                        <div className="absolute -bottom-3 -right-3 lg:-bottom-4 lg:-right-4">
                          <div className="relative group/team">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-md opacity-60 group-hover/team:opacity-80 transition-opacity duration-300" />
                            <IPFSRenderer
                              src={teamNFT?.metadata?.image}
                              className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-full border-3 border-white/20 shadow-lg"
                              height={80}
                              width={80}
                              alt="Team Image"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-xs sm:w-80 sm:h-80 lg:w-[320px] lg:h-[320px] aspect-square bg-gradient-to-br from-slate-700 to-slate-600 rounded-2xl border border-white/10 flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Image
                          src="/assets/icon-star-blue.svg"
                          alt="Mission"
                          width={24}
                          height={24}
                        />
                      </div>
                      <p className="text-gray-400">Mission Image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Mission Info */}
            <div className="flex flex-col justify-center space-y-3 lg:space-y-4 flex-grow mt-6 lg:mt-0">
              {/* Mission Title & Tagline */}
              <div className="space-y-2">
                {mission?.metadata?.name && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-GoodTimes bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent leading-tight">
                    {mission.metadata.name}
                  </h1>
                )}

                {mission?.metadata?.tagline && (
                  <p className="text-lg sm:text-xl text-gray-300 leading-relaxed">
                    {mission.metadata.tagline}
                  </p>
                )}
              </div>

              {/* Team Attribution */}
              {ruleset && teamNFT?.metadata?.name && (
                <div className="flex flex-wrap items-center gap-2 text-gray-400 text-sm">
                  <span>
                    Created on{' '}
                    {new Date(ruleset?.[0]?.start * 1000).toLocaleDateString(
                      'en-US',
                      {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      }
                    )}{' '}
                    by
                  </span>
                  <Link
                    href={`/team/${generatePrettyLink(
                      teamNFT?.metadata?.name
                    )}`}
                    className="font-GoodTimes text-white hover:text-purple-300 underline transition-colors duration-200"
                  >
                    {teamNFT?.metadata?.name}
                  </Link>
                </div>
              )}

              {/* Enhanced Funding Stats Card */}
              <div className="bg-gradient-to-br from-dark-cool to-darkest-cool backdrop-blur-lg rounded-xl p-4 lg:p-5 border border-white/10 shadow-xl w-full max-w-2xl">
                {/* Raised Amount Badge with Manager Actions */}
                <div className="mb-2 flex flex-col md:flex-row items-center justify-between">
                  <Tooltip
                    text={
                      isLoadingTotalFunding
                        ? 'Loading...'
                        : `$${Math.round(
                            (Number(totalFunding || 0) / 1e18 || 0) * ethPrice
                          ).toLocaleString()} USD`
                    }
                    buttonClassName="scale-75"
                    wrap
                  >
                    <div className="inline-flex items-center bg-gradient-to-r from-blue-500 to-blue-700 text-white font-GoodTimes py-2 px-4 rounded-full shadow-lg">
                      <Image
                        src="/assets/icon-raised-tokens.svg"
                        alt="Raised"
                        width={20}
                        height={20}
                        className="mr-2"
                      />
                      {isLoadingTotalFunding ? (
                        <div className="flex items-center">
                          <TextSkeleton width="w-16" height="h-5" />
                          <span className="text-xs opacity-90 ml-2">
                            ETH RAISED
                          </span>
                        </div>
                      ) : (
                        <>
                          {`${truncateTokenValue(
                            Number(totalFunding || 0) / 1e18 || 0,
                            'ETH'
                          ).toLocaleString()} ETH`}
                          <span className="text-base lg:text-lg mr-2"></span>
                          <span className="text-xs opacity-90">RAISED</span>
                        </>
                      )}
                    </div>
                  </Tooltip>
                  <div className="mt-2 md:mt-0 flex flex-col items-center md:items-end gap-2">
                    <Link
                      className="flex flex-col items-center group"
                      href={`https://juicebox.money/v5/arb:${mission?.projectId}`}
                      target="_blank"
                    >
                      <div className="scale-75 group-hover:scale-[0.80] transition-all duration-200">
                        <JuiceboxLogoWhite />
                      </div>
                    </Link>
                    {contributeButton}

                    {/* Compact Manager Actions */}
                    {account && deadlinePassed && isManager && (
                      <div className="flex flex-wrap gap-3">
                        <PrivyWeb3Button
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="group relative bg-white/10 hover:bg-purple-500/20 text-white py-2 px-3 rounded-full transition-all duration-200 border border-white/20 hover:border-purple-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                          label={
                            <div className="flex items-center gap-2">
                              <Image
                                src="/assets/icon-raised-tokens.svg"
                                alt="Send Tokens"
                                width={14}
                                height={14}
                                className="opacity-70 group-hover:opacity-100"
                              />
                              <span className="text-xs font-medium">
                                Tokens
                              </span>
                            </div>
                          }
                          action={sendReservedTokens}
                          isDisabled={!availableTokens}
                        />
                        <PrivyWeb3Button
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="group relative bg-white/10 hover:bg-blue-500/20 text-white py-2 px-3 rounded-full transition-all duration-200 border border-white/20 hover:border-blue-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                          label={
                            <div className="flex items-center gap-2">
                              <Image
                                src="/assets/icon-crowdfunding.svg"
                                alt="Send Payouts"
                                width={14}
                                height={14}
                                className="opacity-70 group-hover:opacity-100"
                              />
                              <span className="text-xs font-medium">
                                Payouts
                              </span>
                            </div>
                          }
                          action={sendPayouts}
                          isDisabled={!availablePayouts}
                        />
                        {stage === 2 && (
                          <PrivyWeb3Button
                            requiredChain={DEFAULT_CHAIN_V5}
                            className="group relative bg-white/10 hover:bg-green-500/20 text-white py-2 px-3 rounded-full transition-all duration-200 border border-white/20 hover:border-green-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                            label={
                              <div className="flex items-center gap-2">
                                <Image
                                  src="/assets/icon-ethereum.svg"
                                  alt="Deploy Liquidity"
                                  width={14}
                                  height={14}
                                  className="opacity-90 group-hover:opacity-100"
                                />
                                <span className="text-xs font-medium">
                                  Liquidity
                                </span>
                              </div>
                            }
                            action={deployLiquidityPool}
                            isDisabled={!poolDeployerAddress}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mb-3">
                  <MissionFundingProgressBar
                    fundingGoal={fundingGoal}
                    volume={Number(totalFunding || 0) / 1e18}
                    compact={true}
                  />
                </div>
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 lg:gap-3">
                  {/* Goal */}
                  <div className="bg-slate-700/40 rounded-lg p-2 lg:p-3 border border-white/5">
                    <div className="flex items-center mb-1">
                      <Image
                        src="/assets/launchpad/target.svg"
                        alt="Goal"
                        width={14}
                        height={14}
                        className="mr-1"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">
                          Goal
                        </span>
                        <Tooltip
                          text={`≈ $${Math.round(
                            (fundingGoal / 1e18) * ethPrice
                          ).toLocaleString()} USD`}
                          buttonClassName="scale-75"
                        >
                          ?
                        </Tooltip>
                      </div>
                    </div>
                    <p className="text-white font-GoodTimes text-xs lg:text-sm">
                      {+(fundingGoal / 1e18).toFixed(3)} ETH
                    </p>
                  </div>

                  {/* Deadline */}
                  <div className="bg-slate-700/40 rounded-lg p-2 lg:p-3 border border-white/5">
                    <div className="flex items-center mb-1">
                      <Image
                        src="/assets/launchpad/clock.svg"
                        alt="Deadline"
                        width={14}
                        height={14}
                        className="mr-1"
                      />
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        {refundPeriodPassed || stage === 4 || stage === 3
                          ? 'Status'
                          : 'Deadline'}
                      </span>
                    </div>
                    <p className="text-white font-GoodTimes text-xs lg:text-sm">
                      {refundPeriodPassed || stage === 4 || stage === 2
                        ? 'PASSED'
                        : stage === 3
                        ? 'REFUND'
                        : duration}
                    </p>
                  </div>

                  {/* Backers */}
                  <div className="bg-slate-700/40 rounded-lg p-2 lg:p-3 border border-white/5">
                    <div className="flex items-center mb-1">
                      <Image
                        src="/assets/icon-backers.svg"
                        alt="Backers"
                        width={14}
                        height={14}
                        className="mr-1"
                      />
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Backers
                      </span>
                    </div>
                    <p className="text-white font-GoodTimes text-xs lg:text-sm">
                      {backers?.length || 0}
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
