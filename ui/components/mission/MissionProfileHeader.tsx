import { DEFAULT_CHAIN_V5 } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import React from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { formatTimeUntilDeadline } from '@/lib/utils/dates'
import { truncateTokenValue } from '@/lib/utils/numbers'
import IPFSRenderer from '../layout/IPFSRenderer'
import Tooltip from '../layout/Tooltip'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionFundingProgressBar from './MissionFundingProgressBar'

interface MissionProfileHeaderProps {
  mission: any
  teamNFT: any
  ruleset: any
  fundingGoal: number
  backers: any[]
  deadline: number | undefined
  stage: number
  poolDeployerAddress: string | undefined
  isManager: boolean
  availableTokens: number
  availablePayouts: number
  sendReservedTokens: () => void
  sendPayouts: () => void
  deployLiquidityPool: () => void
}

const MissionProfileHeader = React.memo(
  ({
    mission,
    teamNFT,
    ruleset,
    fundingGoal,
    backers,
    deadline,
    stage,
    poolDeployerAddress,
    isManager,
    availableTokens,
    availablePayouts,
    sendReservedTokens,
    sendPayouts,
    deployLiquidityPool,
  }: MissionProfileHeaderProps) => {
    const account = useActiveAccount()
    const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')
    const totalFunding = useTotalFunding(mission?.projectId)

    const duration = useMemo(() => {
      return deadline !== undefined
        ? formatTimeUntilDeadline(new Date(deadline))
        : '...loading'
    }, [deadline])

    const deadlinePassed = deadline ? Date.now() > deadline : false

    return (

<section className="relative min-h-screen overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/launchpad/launchpad-featured-mission.png"
            alt="Featured Mission Background"
            fill
            className="object-cover object-center"
            priority
            quality={100}
          />
        </div>
        
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#010618]/80 via-[#1B1C4B]/60 to-[#010618]/80"></div>
        
        {/* Text readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/30"></div>
        
        {/* Mission Content - Direct Display */}
        <div className="relative z-10 w-full mx-auto px-6 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-16 md:py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 xl:gap-20 items-center">
            {/* Left Column - Mission Image */}
            <div className="flex justify-center lg:justify-start order-1 lg:order-1 px-4 md:px-0">
              <div className="relative w-full max-w-md lg:max-w-lg xl:max-w-xl">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  {mission?.metadata?.logoUri && (
                    <IPFSRenderer
                      src={mission?.metadata?.logoUri}
                      className="w-full h-auto object-cover"
                      width={500}
                      height={500}
                      alt="Mission Image"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
                
                {/* Team Image */}
                {teamNFT?.metadata?.image && (
                  <div className="absolute -bottom-4 -right-4 bg-white/10 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20">
                    <IPFSRenderer
                      src={teamNFT?.metadata?.image}
                      className="w-12 h-12 rounded-full object-cover"
                      width={48}
                      height={48}
                      alt="Team Image"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Mission Info */}
            <div className="space-y-6 lg:space-y-8 order-2 lg:order-2">
              {/* Mission Title & Tagline */}
              <div className="space-y-2 md:space-y-3 lg:space-y-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white leading-tight">
                  {mission?.metadata?.name || 'Welcome to the MoonDAO Launchpad'}
                </h1>
                {(mission?.metadata?.tagline || mission?.metadata?.description) && (
                  <p className="text-sm md:text-lg lg:text-xl xl:text-2xl text-white/80 font-light">
                    {mission?.metadata?.tagline || mission?.metadata?.description}
                  </p>
                )}
              </div>

              {/* Team Information */}
              {teamNFT?.metadata?.name && (
                <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-white/10">
                  <div className="relative">
                    {teamNFT?.metadata?.image && (
                      <IPFSRenderer
                        src={teamNFT?.metadata?.image}
                        className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-white/20"
                        width={64}
                        height={64}
                        alt="Team Image"
                      />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/60 text-xs md:text-sm font-medium">
                      {ruleset ? `Created ${new Date(ruleset?.[0]?.start * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })} by` : 'Launched by'}
                    </span>
                    <Link
                      href={`/team/${generatePrettyLink(teamNFT?.metadata?.name)}`}
                      className="text-white font-semibold text-sm md:text-lg hover:text-[#6C407D] transition-colors duration-200"
                    >
                      {teamNFT?.metadata?.name || 'Unknown Team'}
                    </Link>
                  </div>
                </div>
              )}

              {/* Mission Stats Grid */}
              <div className="grid grid-cols-3 gap-1 md:gap-2 lg:gap-4 xl:gap-6">
                {/* Amount Raised */}
                <div className="bg-gradient-to-br from-[#6C407D]/20 to-[#5F4BA2]/20 backdrop-blur-sm rounded-xl md:rounded-2xl p-2 md:p-4 lg:p-6 border border-white/20 flex flex-col justify-center">
                  <div className="flex items-center gap-1 md:gap-3 mb-1 md:mb-3">
                    <span className="text-white/70 text-xs md:text-sm font-medium">Raised</span>
                  </div>
                  <p className="text-sm md:text-lg lg:text-2xl font-bold text-white">
                    {truncateTokenValue(Number(totalFunding || 0) / 1e18, 'ETH')} ETH
                  </p>
                </div>

                {/* Funding Goal */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-2 md:p-4 lg:p-6 border border-white/20 flex flex-col justify-center">
                  <div className="flex items-center gap-1 md:gap-3 mb-1 md:mb-3">
                    <span className="text-white/70 text-xs md:text-sm font-medium">Goal</span>
                  </div>
                  <p className="text-sm md:text-lg lg:text-2xl font-bold text-white">
                    {fundingGoal
                      ? truncateTokenValue(fundingGoal / 1e18, 'ETH')
                      : '0'} ETH
                  </p>
                </div>

                {/* Backers */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-2 md:p-4 lg:p-6 border border-white/20 flex flex-col justify-center">
                  <div className="flex items-center gap-1 md:gap-3 mb-1 md:mb-3">
                    <span className="text-white/70 text-xs md:text-sm font-medium">Backers</span>
                  </div>
                  <p className="text-sm md:text-lg lg:text-2xl font-bold text-white">
                    {backers?.length || 0}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/80 text-sm md:text-base font-medium">Funding Progress</span>
                  <span className="text-white font-bold text-sm md:text-base">
                    {fundingGoal && fundingGoal > 0
                      ? Math.round((Number(totalFunding || 0) / fundingGoal) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 md:h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${fundingGoal && fundingGoal > 0
                        ? Math.min((Number(totalFunding || 0) / fundingGoal) * 100, 100)
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Manager Actions */}
              {account && deadlinePassed && isManager && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 border border-white/10">
                  <p className="text-white/70 text-sm font-medium mb-3">Manager Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={sendReservedTokens}
                      disabled={!availableTokens}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] text-white rounded-lg hover:scale-105 transition-all duration-300 disabled:opacity-50 border border-white/20"
                    >
                      Send Tokens
                    </button>
                    <button
                      onClick={sendPayouts}
                      disabled={!availablePayouts}
                      className="px-4 py-2 text-sm bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-300 disabled:opacity-50 border border-white/20"
                    >
                      Send Payouts
                    </button>
                    {stage === 2 && (
                      <button
                        onClick={deployLiquidityPool}
                        disabled={!poolDeployerAddress}
                        className="px-4 py-2 text-sm bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-300 disabled:opacity-50 border border-white/20"
                      >
                        Deploy Liquidity
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }
)

MissionProfileHeader.displayName = 'MissionProfileHeader'

export default MissionProfileHeader
