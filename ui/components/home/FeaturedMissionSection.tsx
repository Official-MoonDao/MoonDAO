import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import { DEFAULT_CHAIN_V5, FEATURED_MISSION_INDEX } from 'const/config'
import {
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
} from 'const/config'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import useMissionData from '@/lib/mission/useMissionData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { truncateTokenValue } from '@/lib/utils/numbers'
import StandardButton from '@/components/layout/StandardButton'

export default function FeaturedMissionSection({
  missions,
  featuredMissionData,
}: any) {
  const router = useRouter()
  const selectedChain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(selectedChain)

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    abi: MissionTableABI,
    chain: selectedChain,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreator.abi,
    chain: selectedChain,
  })

  const jbControllerContract = useContract({
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi,
    chain: selectedChain,
  })

  const jbDirectoryContract = useContract({
    address: JBV5_DIRECTORY_ADDRESS,
    abi: JBV5Directory.abi,
    chain: selectedChain,
  })

  const jbTokensContract = useContract({
    address: JBV5_TOKENS_ADDRESS,
    abi: JBV5Tokens.abi,
    chain: selectedChain,
  })

  const featuredMission =
    featuredMissionData?.mission || missions?.[FEATURED_MISSION_INDEX] || null

  const {
    subgraphData: featuredMissionSubgraphData,
    fundingGoal: featuredMissionFundingGoal,
    backers: featuredMissionBackers,
  } = useMissionData({
    mission: featuredMission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    projectMetadata: featuredMissionData?.projectMetadata,
    _stage: featuredMissionData?._stage,
    _deadline: featuredMissionData?._deadline,
    _refundPeriod: featuredMissionData?._refundPeriod,
    _primaryTerminalAddress: featuredMissionData?._primaryTerminalAddress,
    _token: featuredMissionData?._token,
    _fundingGoal: featuredMissionData?._fundingGoal,
    _ruleset: featuredMissionData?._ruleset,
    _backers: featuredMissionData?._backers,
  })

  if (!featuredMission) {
    console.log('No featured mission found, returning null')
    return null
  }

  return (
    <section className="relative min-h-[600px] md:min-h-[700px] lg:min-h-[800px] overflow-hidden">
      {/* Background Image */}
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

      {/* Mission Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-16 md:py-24 lg:py-32">
        {/* Featured Mission Header */}
        <div className="text-center mb-8 md:mb-12 lg:mb-16 xl:mb-20">
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white whitespace-nowrap">
            Featured Mission
          </h2>
        </div>

        <JuiceProviders
          projectId={featuredMission?.projectId || 0}
          selectedChain={selectedChain}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
            {/* Left Column - Mission Image */}
            <div className="flex justify-center lg:justify-start order-1 lg:order-1 px-4 md:px-0">
              <div className="relative w-full max-w-md lg:max-w-lg xl:max-w-xl">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image
                    src={
                      getIPFSGateway(
                        featuredMission?.metadata?.logoUri
                      ) || '/assets/project-default.png'
                    }
                    alt={featuredMission?.metadata?.name || 'Mission'}
                    width={500}
                    height={500}
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>

                {/* Team Image */}
                {featuredMission?.team?.metadata?.logoUri && (
                  <div className="absolute -bottom-4 -right-4 bg-white/10 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20">
                    <Image
                      src={getIPFSGateway(
                        featuredMission?.team?.metadata?.logoUri
                      )}
                      alt={featuredMission?.team?.metadata?.name || 'Team'}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover"
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
                  {featuredMission?.metadata?.name ||
                    'Welcome to the MoonDAO Launchpad'}
                </h1>
                {(featuredMission?.metadata?.tagline ||
                  featuredMission?.metadata?.description) && (
                  <p className="text-sm md:text-lg lg:text-xl xl:text-2xl text-white/80 font-light">
                    {featuredMission?.metadata?.tagline ||
                      featuredMission?.metadata?.description}
                  </p>
                )}
              </div>

              {/* Team Information */}
              {featuredMission?.team && (
                <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-white/10">
                  <div className="relative">
                    <Image
                      src={
                        getIPFSGateway(
                          featuredMission?.team?.metadata?.logoUri
                        ) || '/assets/project-default.png'
                      }
                      alt={featuredMission?.team?.metadata?.name || 'Team'}
                      width={64}
                      height={64}
                      className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-white/20"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/60 text-xs md:text-sm font-medium">
                      Launched by
                    </span>
                    <span className="text-white font-semibold text-sm md:text-lg">
                      {featuredMission?.team?.metadata?.name || 'Unknown Team'}
                    </span>
                  </div>
                </div>
              )}

              {/* Mission Stats Grid */}
              <div className="grid grid-cols-3 gap-1 md:gap-2 lg:gap-4 xl:gap-6">
                {/* Amount Raised */}
                <div className="bg-gradient-to-br from-[#6C407D]/20 to-[#5F4BA2]/20 backdrop-blur-sm rounded-xl md:rounded-2xl p-2 md:p-4 lg:p-6 border border-white/20 flex flex-col justify-between">
                  <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3">
                    <Image
                      src="/assets/icon-raised-tokens.svg"
                      alt="Raised"
                      width={24}
                      height={24}
                      className="w-4 h-4 md:w-6 md:h-6 flex-shrink-0"
                    />
                    <span className="text-white/70 text-xs md:text-sm font-medium whitespace-nowrap">
                      Raised
                    </span>
                  </div>
                  <p className="text-sm md:text-lg lg:text-2xl font-bold text-white">
                    {truncateTokenValue(
                      Number(featuredMissionSubgraphData?.volume || 0) / 1e18,
                      'ETH'
                    )}{' '}
                    ETH
                  </p>
                </div>

                {/* Funding Goal */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-2 md:p-4 lg:p-6 border border-white/20 flex flex-col justify-between">
                  <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3">
                    <Image
                      src="/assets/target.png"
                      alt="Goal"
                      width={24}
                      height={24}
                      className="w-4 h-4 md:w-6 md:h-6 flex-shrink-0"
                    />
                    <span className="text-white/70 text-xs md:text-sm font-medium whitespace-nowrap">
                      Goal
                    </span>
                  </div>
                  <p className="text-sm md:text-lg lg:text-2xl font-bold text-white">
                    {featuredMissionFundingGoal
                      ? truncateTokenValue(
                          featuredMissionFundingGoal / 1e18,
                          'ETH'
                        )
                      : '0'}{' '}
                    ETH
                  </p>
                </div>

                {/* Backers */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl md:rounded-2xl p-2 md:p-4 lg:p-6 border border-white/20 flex flex-col justify-between">
                  <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3">
                    <Image
                      src="/assets/icon-backers.svg"
                      alt="Backers"
                      width={24}
                      height={24}
                      className="w-4 h-4 md:w-6 md:h-6 flex-shrink-0"
                    />
                    <span className="text-white/70 text-xs md:text-sm font-medium whitespace-nowrap">
                      Backers
                    </span>
                  </div>
                  <p className="text-sm md:text-lg lg:text-2xl font-bold text-white">
                    {featuredMissionBackers?.length || 0}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/80 text-sm md:text-base font-medium">
                    Funding Progress
                  </span>
                  <span className="text-white font-bold text-sm md:text-base">
                    {featuredMissionFundingGoal &&
                    featuredMissionFundingGoal > 0
                      ? Math.round(
                          (Number(featuredMissionSubgraphData?.volume || 0) /
                            featuredMissionFundingGoal) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 md:h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${
                        featuredMissionFundingGoal &&
                        featuredMissionFundingGoal > 0
                          ? Math.min(
                              (Number(
                                featuredMissionSubgraphData?.volume || 0
                              ) /
                                featuredMissionFundingGoal) *
                                100,
                              100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-row gap-2 md:gap-4 pt-4">
                <StandardButton
                  className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] text-white font-semibold text-xs md:text-sm px-3 md:px-4 lg:px-6 py-2 md:py-3 rounded-lg md:rounded-xl hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 border border-white/20 text-center w-full flex items-center justify-center"
                  link={`/mission/${featuredMission?.id}`}
                  hoverEffect={false}
                >
                  <span className="ml-1 md:ml-2">Contribute</span>
                </StandardButton>
              </div>
            </div>
          </div>
        </JuiceProviders>
      </div>
    </section>
  )
}
