import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  JBV5_CONTROLLER_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { GetStaticProps, GetStaticPropsResult } from 'next'
import { useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { fetchFeaturedMissionData } from '@/lib/launchpad/fetchFeaturedMission'
import { fetchMissions } from '@/lib/launchpad/fetchMissions'
import { FeaturedMissionData, Mission } from '@/lib/launchpad/types'
import { useLaunchStatus } from '@/lib/launchpad/useLaunchStatus'
import { useLaunchpadAccess } from '@/lib/launchpad/useLaunchpadAccess'
import { useTeamManagerCheck } from '@/lib/launchpad/useTeamManagerCheck'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'
<<<<<<< HEAD
import GetStartedToday from '@/components/launchpad/GetStartedToday'
import GoFurtherTogether from '@/components/launchpad/GoFurtherTogether'
import LaunchHero from '@/components/launchpad/LaunchHero'
import LaunchpadFAQ from '@/components/launchpad/LaunchpadFAQ'
import PowerOfDecentralization from '@/components/launchpad/PowerOfDecentralization'
import ProvenFinancingModel from '@/components/launchpad/ProvenFinancingModel'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
=======
import ExplainerIcon from '@/components/launchpad/ExplainerIcon'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'
import LaunchpadFAQs from '@/components/launchpad/LaunchpadFAQs'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import VerticalProgressScrollBar from '@/components/layout/VerticalProgressScrollBar'
>>>>>>> 8eed1060cdc6cd5be0dfa89d088121bea02c735d
import CreateMission from '@/components/mission/CreateMission'

type LaunchProps = {
  missions: Mission[]
  featuredMissionData: FeaturedMissionData | null
}

export default function Launch({ missions, featuredMissionData }: LaunchProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: TeamABI as any,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: MissionCreator.abi as any,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    chain: selectedChain,
    abi: HatsABI as any,
  })

  const { userTeams, isLoading: userTeamsLoading } = useTeamWearer(
    teamContract,
    selectedChain,
    address
  )

  const { userTeamsAsManager, isLoading: userTeamsAsManagerLoading } = useTeamManagerCheck(
    teamContract,
    userTeams,
    address,
    userTeamsLoading
  )

  const { hasAccess: citizenHasAccess } = useLaunchpadAccess(
    userTeamsAsManager,
    userTeamsAsManagerLoading
  )

  const { status, setStatus, handleCreateMission } = useLaunchStatus(userTeamsAsManager)

  if (status === 'create' && citizenHasAccess) {
    return (
      <CreateMission
        selectedChain={selectedChain}
        missionCreatorContract={missionCreatorContract}
        teamContract={teamContract}
        hatsContract={hatsContract}
        setStatus={setStatus}
        userTeams={userTeams}
        userTeamsAsManager={userTeamsAsManager}
        userTeamsAsManagerLoading={userTeamsLoading || userTeamsAsManagerLoading}
      />
    )
  }

  return (
    <>
      <LaunchHero citizenHasAccess={citizenHasAccess} onLaunchClick={handleCreateMission} />
      <FeaturedMissionSection missions={missions} featuredMissionData={featuredMissionData} />
<<<<<<< HEAD
      <GoFurtherTogether />
      <ProvenFinancingModel />
      <PowerOfDecentralization />
      <GetStartedToday citizenHasAccess={citizenHasAccess} onLaunchClick={handleCreateMission} />
      <LaunchpadFAQ />
      <ExpandedFooter
        callToActionTitle="Join the Network"
        callToActionBody="Be part of the space acceleration network and play a role in establishing a permanent human presence on the moon and beyond!"
        callToActionImage="/assets/SAN-logo-dark.svg"
        callToActionButtonText="Join the Network"
        callToActionButtonLink="/join"
        hasCallToAction={true}
      />
=======

      {/* Go Further Together Section - Fullscreen Space Theme */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/launchpad/Astronaut-Handshake.png"
            alt="Astronaut Handshake Background"
            fill
            className="object-cover object-center"
            priority
            quality={100}
          />
        </div>

        {/* Main Content Container */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-4 md:mb-6">
              Go Further Together
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-12 items-center">
              {/* Finance Card */}
              <div className="bg-gradient-to-br from-[#6C407D]/40 to-[#5F4BA2]/40 backdrop-blur-sm rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group h-full">
                <div className="flex flex-col items-center text-center space-y-4 md:space-y-6 h-full">
                  <div className="bg-gradient-to-br from-[#6C407D] to-[#5F4BA2] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-crowdfunding.svg"
                      alt="Finance"
                      width={48}
                      height={48}
                      className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-GoodTimes text-white mb-2 md:mb-4">
                      Finance
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      Fund with your debit card, even if you've never used crypto. Get refunded if a
                      mission fails to reach its funding goal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Coordinate Card */}
              <div className="bg-gradient-to-br from-[#5F4BA2]/60 to-[#5159CC]/60 backdrop-blur-sm rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group h-full">
                <div className="flex flex-col items-center text-center space-y-4 md:space-y-6 h-full">
                  <div className="bg-gradient-to-br from-[#5F4BA2] to-[#5159CC] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-fasttrack.svg"
                      alt="Coordinate"
                      width={48}
                      height={48}
                      className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-GoodTimes text-white mb-2 md:mb-4">
                      Coordinate
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      Contributions earn mission tokens that give you a stake in the journey,
                      allowing you to help shape and govern the outcome.
                    </p>
                  </div>
                </div>
              </div>

              {/* Verify Card */}
              <div className="bg-gradient-to-br from-[#5159CC]/60 to-[#4660E7]/60 backdrop-blur-sm rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group h-full">
                <div className="flex flex-col items-center text-center space-y-4 md:space-y-6 h-full">
                  <div className="bg-gradient-to-br from-[#5159CC] to-[#4660E7] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-lightbulb.svg"
                      alt="Verify"
                      width={48}
                      height={48}
                      className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-GoodTimes text-white mb-2 md:mb-4">
                      Verify
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      Secured by code, not promises. 100% transparent use of funds onchain, allowing
                      contributors to trace how funds were spent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Text */}
          <div className="flex flex-col items-center mt-12 md:mt-16 lg:mt-20 px-4">
            <p className="text-center max-w-2xl md:max-w-3xl lg:max-w-4xl text-white/90 text-sm md:text-lg lg:text-xl xl:text-2xl font-semibold leading-relaxed">
              <span className="hidden md:inline">
                Join a revolution in space funding. Unlike traditional fundraising, your community
                can
                <br />
                immediately coordinate governance, access liquidity, and grow into a viral movement.
              </span>
              <span className="inline md:hidden">
                Join a revolution in space funding. Unlike traditional fundraising, your community
                can immediately coordinate governance, access liquidity, and grow into a viral
                movement.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Proven Financing Model Section - Fullscreen Space Theme */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/launchpad/Lunar-Crystals.png"
            alt="Lunar Crystals Background"
            fill
            className="object-cover object-center"
            priority
            quality={100}
          />
        </div>

        {/* Main Content Container */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-4 md:mb-6">
              Proven Financing Model
            </h2>
          </div>

          {/* Achievement Cards */}
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {/* $8 Million Raised */}
              <div className="bg-gradient-to-br from-[#6C407D]/20 to-[#5F4BA2]/20 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group">
                <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                  <div className="bg-gradient-to-br from-[#6C407D] to-[#5F4BA2] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-raised-tokens.svg"
                      alt="Dollars Raised"
                      width={48}
                      height={48}
                      className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                    />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl lg:text-2xl font-GoodTimes text-white mb-1 md:mb-2">
                      $8
                      <br />
                      Million
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      Dollars raised through decentralized funding.
                    </p>
                  </div>
                </div>
              </div>

              {/* 12,000 $MOONEY Holders */}
              <div className="bg-gradient-to-br from-[#4660E7]/20 to-[#6C407D]/20 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group">
                <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                  <div className="bg-gradient-to-br from-[#4660E7] to-[#6C407D] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-powerful.svg"
                      alt="Token Holders"
                      width={48}
                      height={48}
                      className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                    />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl lg:text-2xl font-GoodTimes text-white mb-1 md:mb-2">
                      12,000
                      <br />
                      holders
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      $MOONEY token holders.
                    </p>
                  </div>
                </div>
              </div>

              {/* 80 Projects Funded */}
              <div className="bg-gradient-to-br from-[#5F4BA2]/20 to-[#5159CC]/20 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group">
                <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                  <div className="bg-gradient-to-br from-[#5F4BA2] to-[#5159CC] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-lightbulb.svg"
                      alt="Projects Funded"
                      width={48}
                      height={48}
                      className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                    />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl lg:text-2xl font-GoodTimes text-white mb-1 md:mb-2">
                      80
                      <br />
                      Projects
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      Successfully funded and launched.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2 People Sent to Space */}
              <div className="bg-gradient-to-br from-[#5159CC]/20 to-[#4660E7]/20 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group">
                <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                  <div className="bg-gradient-to-br from-[#5159CC] to-[#4660E7] rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src="/assets/icon-fasttrack.svg"
                      alt="People in Space"
                      width={48}
                      height={48}
                      className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                    />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl lg:text-2xl font-GoodTimes text-white mb-1 md:mb-2">
                      2<br />
                      People
                    </h3>
                    <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                      Successfully sent to space.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Text */}
          <div className="text-center mt-12 md:mt-16 lg:mt-20 px-4">
            <p className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl text-white/90 text-sm md:text-lg lg:text-xl xl:text-2xl font-semibold leading-relaxed mx-auto">
              <span className="hidden md:inline">
                MoonDAO's journey from concept to space, powered by decentralized funding.
                <br />
                We raised millions, engaged thousands, funded over 80 projects, and sent two people
                to space.
              </span>
              <span className="inline md:hidden">
                MoonDAO's journey from concept to space, powered by decentralized funding. We raised
                millions, engaged thousands, funded over 80 projects, and sent two people to space.
              </span>
            </p>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
        <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
      </section>

      {/* Power of Decentralization Section - Fullscreen Space Theme */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/launchpad/Lunar-Satellites.png"
            alt="Lunar Satellites Background"
            fill
            className="object-cover object-center"
            priority
            quality={100}
          />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          {/* Section Header */}
          <div className="absolute top-8 md:top-16 lg:top-20 left-1/2 transform -translate-x-1/2 z-20 px-4">
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white text-center mb-2 md:mb-4">
              The Power of Decentralization
            </h2>
            <p className="text-white/80 text-sm md:text-base lg:text-lg xl:text-xl text-center max-w-3xl mx-auto">
              Experience the advantages of transparent, community-driven space funding.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="max-w-7xl mx-auto mt-32 md:mt-40 lg:mt-48 xl:mt-56">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 xl:gap-12">
              {/* Global Access */}
              <div className="relative group h-64 md:h-72 lg:h-80 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#6C407D] to-[#5F4BA2] rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
                    <div className="bg-gradient-to-br from-[#6C407D] to-[#5F4BA2] rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src="/assets/icon-globe.svg"
                        alt="Global Access"
                        width={48}
                        height={48}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
                        Global Access
                      </h3>
                      <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                        Tap into a global crypto network with trillions of dollars at your
                        fingertips.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trustless */}
              <div className="relative group h-64 md:h-72 lg:h-80 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5F4BA2] to-[#5159CC] rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
                    <div className="bg-gradient-to-br from-[#5F4BA2] to-[#5159CC] rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src="/assets/icon-signature.svg"
                        alt="Trustless"
                        width={48}
                        height={48}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
                        Trustless
                      </h3>
                      <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                        All transactions are onchain, ensuring that everyone can see how funds are
                        spent.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Battle Tested */}
              <div className="relative group h-64 md:h-72 lg:h-80 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5159CC] to-[#4660E7] rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
                    <div className="bg-gradient-to-br from-[#5159CC] to-[#4660E7] rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src="/assets/icon-checkmark.svg"
                        alt="Battle Tested"
                        width={48}
                        height={48}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
                        Battle Tested
                      </h3>
                      <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                        Powered by Juicebox, a proven and audited platform with over 1,000+ projects
                        and over $200,000,000+ raised.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scalable */}
              <div className="relative group h-64 md:h-72 lg:h-80 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#4660E7] to-[#6C407D] rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
                    <div className="bg-gradient-to-br from-[#4660E7] to-[#6C407D] rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src="/assets/icon-scalable.svg"
                        alt="Scalable"
                        width={48}
                        height={48}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
                        Scalable
                      </h3>
                      <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                        Adapt your fundraising strategy as your mission evolves with our quick
                        launch guidelines and templates.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Power of the Network */}
              <div className="relative group h-64 md:h-72 lg:h-80 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#6C407D] to-[#5F4BA2] rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
                    <div className="bg-gradient-to-br from-[#6C407D] to-[#5F4BA2] rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src="/assets/icon-powerful.svg"
                        alt="Power of the Network"
                        width={48}
                        height={48}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
                        Power of the Network
                      </h3>
                      <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                        The Space Acceleration Network brings leading space companies, enthusiasts,
                        and professionals onchain from around the globe.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Internet Speed */}
              <div className="relative group h-64 md:h-72 lg:h-80 w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-[#5F4BA2] to-[#5159CC] rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
                    <div className="bg-gradient-to-br from-[#5F4BA2] to-[#5159CC] rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src="/assets/icon-fasttrack.svg"
                        alt="Internet Speed"
                        width={48}
                        height={48}
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
                        Internet Speed
                      </h3>
                      <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                        Launch and fund your mission in minutes, not months, with instant global
                        access to capital.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
        <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
      </section>

      {/* Get Started Today Section - Fullscreen Space Theme */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/assets/launchpad/launchpad-video.png"
            alt="Launchpad Video Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-6xl mx-auto text-center">
            {/* Logo */}
            <div className="mb-8 md:mb-12">
              <Image
                src="/assets/MoonDAO Animated Logo - White.svg"
                alt="MoonDAO Logo"
                width={550}
                height={550}
                className="w-24 md:w-32 lg:w-40 xl:w-48 mx-auto"
              />
            </div>

            {/* Content */}
            <div className="space-y-6 md:space-y-8">
              <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-4 md:mb-6">
                Get Started Today
              </h2>
              <p className="text-white/90 text-sm md:text-lg lg:text-xl xl:text-2xl max-w-3xl mx-auto leading-relaxed px-4">
                The next great space mission starts here. Join the decentralized space race and fund
                your mission with the Launchpad.
              </p>

              {/* CTA Button */}
              <div className="pt-6 md:pt-8">
                <div className="relative group">
                  {/* Main button */}
                  {citizenHasAccess && (
                    <StandardButton
                      id="launch-mission-button-3"
                      className="relative bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] text-white font-semibold text-sm sm:text-base px-6 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 border-0 backdrop-blur-sm text-center"
                      onClick={handleCreateMission}
                      hoverEffect={false}
                    >
                      <div className="flex items-center justify-center w-full text-center">
                        <span className="relative text-center pl-2 sm:pl-4">
                          Launch Your Mission
                          {/* Text glow effect */}
                          <span className="absolute inset-0 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent blur-sm opacity-50"></span>
                        </span>

                        {/* Arrow icon */}
                        <svg
                          className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300 ml-1 sm:ml-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                    </StandardButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
        <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
      </section>

      {/* FAQ Section - Fullscreen Space Theme */}
      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0A0A0A] via-[#1A1A2E] to-[#16213E]">
        {/* Background */}
        <div className="absolute inset-0">
          {/* Animated orbs */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] rounded-full opacity-20 blur-xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-gradient-to-r from-[#5159CC] to-[#4660E7] rounded-full opacity-30 blur-lg animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-gradient-to-r from-[#4660E7] to-[#6C407D] rounded-full opacity-25 blur-lg animate-pulse delay-2000"></div>
          <div className="absolute top-3/4 left-1/3 w-16 h-16 bg-gradient-to-r from-[#5F4BA2] to-[#5159CC] rounded-full opacity-15 blur-lg animate-pulse delay-1500"></div>

          {/* Nebula swirls */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#6C407D]/10 to-[#5F4BA2]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#5159CC]/10 to-[#4660E7]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-[#4660E7]/5 to-[#6C407D]/5 rounded-full blur-3xl"></div>

          {/* Constellation dots */}
          <div className="absolute top-1/5 right-1/3 w-1 h-1 bg-white/30 rounded-full"></div>
          <div className="absolute top-2/5 left-1/5 w-1 h-1 bg-cyan-400/40 rounded-full"></div>
          <div className="absolute top-3/5 right-1/4 w-1 h-1 bg-purple-400/30 rounded-full"></div>
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-pink-400/40 rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/5 w-1 h-1 bg-blue-400/30 rounded-full"></div>
        </div>

        {/* Main Content Container */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-6 md:mb-8">
              Frequently Asked Questions
            </h2>
            <p className="text-white/80 text-base md:text-lg lg:text-xl xl:text-2xl text-center max-w-3xl mx-auto leading-relaxed">
              Everything you need to know about launching your space mission.
            </p>
          </div>

          {/* FAQ Content */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-8 lg:p-12 border border-white/20 shadow-2xl">
              <div className="relative">
                {/* Decorative background elements */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#6C407D]/5 to-[#5F4BA2]/5 rounded-3xl"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] rounded-t-3xl"></div>

                {/* Content */}
                <div className="relative z-10">
                  <LaunchpadFAQs />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
        <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
      </section>
      <div className="flex justify-center w-full">
        <NoticeFooter />
      </div>
>>>>>>> 8eed1060cdc6cd5be0dfa89d088121bea02c735d
    </>
  )
}

export const getStaticProps: GetStaticProps = async (): Promise<
  GetStaticPropsResult<LaunchProps>
> => {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missions = await fetchMissions(
      chain,
      chainSlug,
      MISSION_TABLE_ADDRESSES[chainSlug],
      JBV5_CONTROLLER_ADDRESS
    )

    const featuredMissionData = await fetchFeaturedMissionData(
      missions,
      chain,
      chainSlug,
      JBV5_CONTROLLER_ADDRESS,
      JBV5Controller.abi as any
    )

    return {
      props: {
        missions,
        featuredMissionData,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error in getStaticProps:', error)

    return {
      props: {
        missions: [
          {
            id: 'fallback-1',
            teamId: null,
            projectId: null,
            metadata: {
              name: 'MoonDAO Launchpad',
              description: 'Welcome to the MoonDAO Launchpad. Mission data is being loaded.',
              image: '/Original.png',
            },
          },
        ],
        featuredMissionData: null,
      },
      revalidate: 60,
    }
  }
}
