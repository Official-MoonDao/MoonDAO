import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import LaunchPadPayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { FEATURED_MISSION_INDEX } from 'const/config'
import { LAUNCHPAD_WHITELISTED_CITIZENS } from 'const/missions'
import { BLOCKED_MISSIONS } from 'const/whitelist'
import { GetStaticProps, GetStaticPropsResult } from 'next'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import { getBackers } from '@/lib/mission'
import useMissionData from '@/lib/mission/useMissionData'
import { sepolia } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { truncateTokenValue } from '@/lib/utils/numbers'
import FeaturedMissionSection from '@/components/home/FeaturedMissionSection'
import ExplainerIcon from '@/components/launchpad/ExplainerIcon'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'
import LaunchpadFAQs from '@/components/launchpad/LaunchpadFAQs'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import StandardButton from '@/components/layout/StandardButton'
import VerticalProgressScrollBar from '@/components/layout/VerticalProgressScrollBar'
import CreateMission from '@/components/mission/CreateMission'
import MissionWideCard from '@/components/mission/MissionWideCard'

export default function Launch({ missions, featuredMissionData }: any) {
  const router = useRouter()
  const shallowQuery = useShallowQueryRoute()

  const [status, setStatus] = useState<
    'idle' | 'loggingIn' | 'apply' | 'create'
  >(router.query.status as any)

  const account = useActiveAccount()
  const address = account?.address
  const { user } = usePrivy()
  const { login } = useLogin({
    onComplete: (user, isNewUser, wasAlreadyAuthenticated) => {
      if (!wasAlreadyAuthenticated && status === 'loggingIn') {
        handleCreateMission()
      }
    },
  })

  const { citizen } = useContext(CitizenContext)
  const citizenHasAccess =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
      ? LAUNCHPAD_WHITELISTED_CITIZENS.includes(citizen?.id)
      : true

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

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: MissionTableABI as any,
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

  const [userTeamsAsManager, setUserTeamsAsManager] = useState<any>()
  const [userTeamsAsManagerLoading, setUserTeamsAsManagerLoading] =
    useState(false)

  const { data: ethPrice } = useETHPrice(1)

  useEffect(() => {
    async function getUserTeamsAsManager() {
      if (!userTeams) return
      setUserTeamsAsManagerLoading(true)
      setUserTeamsAsManager(undefined)

      const teamChecks = await Promise.all(
        userTeams.map(async (hat: any) => {
          if (!hat?.teamId || !hat.hats?.[0].id)
            return { hat, isManager: false }

          const managerHatId: any = await readContract({
            contract: teamContract,
            method: 'teamManagerHat' as string,
            params: [hat.teamId],
          })

          const isManager = hatIdDecimalToHex(managerHatId) === hat.hats?.[0].id

          return { hat, isManager }
        })
      )

      const teamsAsManager = teamChecks
        .filter(({ isManager }) => isManager)
        .map(({ hat }) => hat)

      setUserTeamsAsManager(teamsAsManager)
      setUserTeamsAsManagerLoading(false)
    }
    if (teamContract && userTeams && address && !userTeamsLoading) {
      getUserTeamsAsManager()
    } else {
      setUserTeamsAsManager(undefined)
      setUserTeamsAsManagerLoading(true)
    }
  }, [teamContract, userTeams, address])

  async function handleCreateMission() {
    if (!user) {
      setStatus('loggingIn')
      return login()
    }
    //Check if wallet is whitelisted or is a manager of a team
    const isWhitelisted = true
    if (
      (userTeamsAsManager && userTeamsAsManager.length > 0) ||
      isWhitelisted
    ) {
      setStatus('create')
    } else {
      setStatus('apply')
    }
  }

  useEffect(() => {
    if (status) {
      shallowQuery({
        status: status,
      })
    }
  }, [status])

  useEffect(() => {
    if (router.query.status) {
      if (
        !(
          user &&
          router.query.status === 'loggingIn' &&
          (status === 'create' || status === 'apply')
        )
      ) {
        setStatus(router.query.status as any)
      }
    } else {
      setStatus('idle')
    }
  }, [router.query.status, user])

  useEffect(() => {
    if (
      (router.query.status === 'create' ||
        router.query.status === 'loggingIn') &&
      !account
    ) {
      login()
    }
  }, [router.query.status, account, login])

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
        userTeamsAsManagerLoading={
          userTeamsLoading || userTeamsAsManagerLoading
        }
      />
    )
  }

  return (
    <>
      <section className="relative h-screen overflow-hidden">
        {/* High-quality background image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/launchpad/moondao-launchpad-hero.png"
            alt="MoonDAO Launchpad Hero"
            fill
            className="object-cover object-center"
            priority
            quality={100}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#010618]/80 via-[#010618]/60 to-transparent"></div>
        </div>

        {/* Hero content - positioned higher up from bottom */}
        <div className="relative z-10 h-full flex flex-col justify-end">
          <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-12 md:pb-16 lg:pb-20 xl:pb-24">
            <div className="max-w-2xl">
              {/* MoonDAO Logo */}
              <div className="mb-4 md:mb-6">
                <Image
                  src="/assets/Tagline Animation - inline centered.svg"
                  alt="MoonDAO"
                  width={300}
                  height={75}
                  className="w-32 sm:w-40 md:w-48 lg:w-64 xl:w-72"
                />
              </div>

              {/* Main heading */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-GoodTimes text-white mb-4 md:mb-6 leading-tight">
                Launchpad
              </h1>

              {/* Description */}
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-white/90 mb-6 md:mb-8 leading-relaxed max-w-xl">
                Fund the future of space exploration with decentralized
                crowdfunding.
              </p>

              {/* CTA Button - enhanced with flair */}
              <div className="flex justify-start mb-16 sm:mb-12 md:mb-8 lg:mb-0">
                <div className="relative group">
                  {/* Glow effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Main button */}
                  {citizenHasAccess && (
                    <StandardButton
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
        <Image
          src="/assets/launchpad/blue-divider-rl.svg"
          alt=""
          width={200}
          height={200}
          className="absolute bottom-0 right-0 w-32 md:w-48 opacity-50"
        />

        {/* Scroll indicator */}
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <div
            className="flex flex-col items-center text-white/70 hover:text-white/90 transition-colors duration-300 cursor-pointer group"
            onClick={() => {
              const featuredMissionSection =
                document.getElementById('featured-mission')
              if (featuredMissionSection) {
                featuredMissionSection.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
            }}
          >
            <span className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 tracking-wider uppercase">
              Scroll to explore
            </span>
            <div className="relative">
              {/* Animated scroll arrow */}
              <svg
                className="w-4 h-4 sm:w-6 sm:h-6 animate-bounce group-hover:animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>

              {/* Glow effect */}
              <div className="absolute inset-0 bg-white/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>

            {/* Scroll line indicator */}
            <div className="mt-2 sm:mt-3 w-px h-6 sm:h-8 bg-gradient-to-b from-white/50 to-transparent"></div>
          </div>
        </div>
      </section>

      {/* Featured Mission Section */}
      <FeaturedMissionSection
        missions={missions}
        featuredMissionData={featuredMissionData}
      />

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
                      Fund with your debit card, even if you've never used
                      crypto. Get refunded if a mission fails to reach its
                      funding goal.
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
                      Contributions earn mission tokens that give you a stake in
                      the journey, allowing you to help shape and govern the
                      outcome.
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
                      Secured by code, not promises. 100% transparent use of
                      funds onchain, allowing contributors to trace how funds
                      were spent.
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
                Join a revolution in space funding. Unlike traditional
                fundraising, your community can
                <br />
                immediately coordinate governance, access liquidity, and grow
                into a viral movement.
              </span>
              <span className="inline md:hidden">
                Join a revolution in space funding. Unlike traditional
                fundraising, your community can immediately coordinate
                governance, access liquidity, and grow into a viral movement.
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
                MoonDAO's journey from concept to space, powered by
                decentralized funding.
                <br />
                We raised millions, engaged thousands, funded over 80 projects,
                and sent two people to space.
              </span>
              <span className="inline md:hidden">
                MoonDAO's journey from concept to space, powered by
                decentralized funding. We raised millions, engaged thousands,
                funded over 80 projects, and sent two people to space.
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
              Experience the advantages of transparent, community-driven space
              funding.
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
                        Tap into a global crypto network with trillions of
                        dollars at your fingertips.
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
                        All transactions are onchain, ensuring that everyone can
                        see how funds are spent.
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
                        Powered by Juicebox, a proven and audited platform with
                        over 1,000+ projects and over $200,000,000+ raised.
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
                        Adapt your fundraising strategy as your mission evolves
                        with our quick launch guidelines and templates.
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
                        The Space Acceleration Network brings leading space
                        companies, enthusiasts, and professionals onchain from
                        around the globe.
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
                        Launch and fund your mission in minutes, not months,
                        with instant global access to capital.
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
                The next great space mission starts here. Join the decentralized
                space race and fund your mission with the Launchpad.
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
      <ExpandedFooter
        callToActionTitle="Join the Network"
        callToActionBody="Be part of the space acceleration network and play a role in establishing a permanent human presence on the moon and beyond!"
        callToActionImage="/assets/SAN-logo-dark.svg"
        callToActionButtonText="Join the Network"
        callToActionButtonLink="/join"
        hasCallToAction={true}
      />
    </>
  )
}

export const getStaticProps: GetStaticProps = async (): Promise<
  GetStaticPropsResult<any>
> => {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missionTableContract = getContract({
      client: serverClient,
      address: MISSION_TABLE_ADDRESSES[chainSlug],
      abi: MissionTableABI as any,
      chain: chain,
    })

    const missionTableName: any = await readContract({
      contract: missionTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const statement = `SELECT * FROM ${missionTableName}`

    const missionRows = await queryTable(chain, statement)

    const filteredMissionRows = missionRows.filter((mission: any) => {
      return !BLOCKED_MISSIONS.has(mission.id) && mission && mission.id
    })

    const jbV5ControllerContract = getContract({
      client: serverClient,
      address: JBV5_CONTROLLER_ADDRESS,
      abi: JBV5Controller.abi as any,
      chain: chain,
    })

    // Process missions with rate limiting protection
    const missions = await Promise.all(
      filteredMissionRows.map(async (missionRow: any, index: number) => {
        try {
          // Add delay between requests to avoid rate limiting
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }

          if (!missionRow?.projectId) {
            return {
              id: missionRow?.id || `fallback-${index}`,
              teamId: missionRow?.teamId || null,
              projectId: null,
              metadata: {
                name: 'Mission Loading...',
                description: 'Mission data is being loaded.',
                image: '/assets/placeholder-mission.png',
              },
            }
          }

          const metadataURI = await readContract({
            contract: jbV5ControllerContract,
            method: 'uriOf' as string,
            params: [missionRow.projectId],
          })

          const metadataRes = await fetch(getIPFSGateway(metadataURI))
          const metadata = await metadataRes.json()

          return {
            id: missionRow.id,
            teamId: missionRow.teamId,
            projectId: missionRow.projectId,
            fundingGoal: missionRow.fundingGoal || 0,
            metadata: metadata,
          }
        } catch (error) {
          console.warn(`Failed to fetch mission ${missionRow?.id}:`, error)
          return {
            id: missionRow?.id || `fallback-${index}`,
            teamId: missionRow?.teamId || null,
            projectId: missionRow?.projectId || null,
            fundingGoal: missionRow?.fundingGoal || 0,
            metadata: {
              name: 'Mission Unavailable',
              description: 'This mission is temporarily unavailable.',
              image: '/assets/placeholder-mission.png',
            },
          }
        }
      })
    )

    const filteredMissions = missions.filter((mission) => mission !== null)

    let featuredMissionData: any = null
    const featuredMission =
      filteredMissions.find(
        (mission: any) =>
          mission.projectId &&
          mission.projectId > 0 &&
          mission.fundingGoal &&
          mission.fundingGoal > 0
      ) ||
      (filteredMissions.length > 0
        ? filteredMissions[FEATURED_MISSION_INDEX] || filteredMissions[0]
        : null)

    if (featuredMission && featuredMission.projectId) {
      try {
        const jbDirectoryContract = getContract({
          client: serverClient,
          address: JBV5_DIRECTORY_ADDRESS,
          abi: JBV5Directory.abi as any,
          chain: chain,
        })

        const missionCreatorContract = getContract({
          client: serverClient,
          address: MISSION_CREATOR_ADDRESSES[chainSlug],
          abi: MissionCreator.abi as any,
          chain: chain,
        })

        const jbTokensContract = getContract({
          client: serverClient,
          address: JBV5_TOKENS_ADDRESS,
          abi: JBV5Tokens.abi as any,
          chain: chain,
        })

        const [
          stage,
          payHookAddress,
          tokenAddress,
          primaryTerminalAddress,
          ruleset,
        ] = await Promise.all([
          readContract({
            contract: missionCreatorContract,
            method: 'stage' as string,
            params: [featuredMission.id],
          }).catch(() => null),
          readContract({
            contract: missionCreatorContract,
            method: 'missionIdToPayHook' as string,
            params: [featuredMission.id],
          }).catch(() => null),
          readContract({
            contract: jbTokensContract,
            method: 'tokenOf' as string,
            params: [featuredMission.projectId],
          }).catch(() => null),
          readContract({
            contract: jbDirectoryContract,
            method: 'primaryTerminalOf' as string,
            params: [featuredMission.projectId, JB_NATIVE_TOKEN_ADDRESS],
          }).catch(() => '0x0000000000000000000000000000000000000000'),
          readContract({
            contract: jbV5ControllerContract,
            method: 'currentRulesetOf' as string,
            params: [featuredMission.projectId],
          }).catch(() => null),
        ])

        let deadline: number | undefined = undefined
        let refundPeriod: number | undefined = undefined

        if (
          payHookAddress &&
          payHookAddress !== '0x0000000000000000000000000000000000000000'
        ) {
          try {
            const payHookContract = getContract({
              client: serverClient,
              address: payHookAddress,
              chain: chain,
              abi: LaunchPadPayHookABI.abi as any,
            })

            const [dl, rp] = await Promise.all([
              readContract({
                contract: payHookContract,
                method: 'deadline' as string,
                params: [],
              }).catch(() => null),
              readContract({
                contract: payHookContract,
                method: 'refundPeriod' as string,
                params: [],
              }).catch(() => null),
            ])

            if (dl) deadline = +dl.toString() * 1000
            if (rp) refundPeriod = +rp.toString() * 1000
          } catch (error) {
            console.warn('Failed to fetch deadline/refundPeriod:', error)
          }
        }

        let tokenData: any = {
          tokenAddress: tokenAddress || '',
          tokenName: '',
          tokenSymbol: '',
          tokenSupply: '',
        }

        if (
          tokenAddress &&
          tokenAddress !== '0x0000000000000000000000000000000000000000'
        ) {
          try {
            const tokenContract = getContract({
              client: serverClient,
              address: tokenAddress,
              abi: JBV5Token as any,
              chain: chain,
            })

            const [nameResult, symbolResult, supplyResult] =
              await Promise.allSettled([
                readContract({
                  contract: tokenContract,
                  method: 'name' as string,
                  params: [],
                }),
                readContract({
                  contract: tokenContract,
                  method: 'symbol' as string,
                  params: [],
                }),
                readContract({
                  contract: tokenContract,
                  method: 'totalSupply' as string,
                  params: [],
                }),
              ])

            if (nameResult.status === 'fulfilled' && nameResult.value) {
              tokenData.tokenName = nameResult.value
            }
            if (symbolResult.status === 'fulfilled' && symbolResult.value) {
              tokenData.tokenSymbol = symbolResult.value
            }
            if (supplyResult.status === 'fulfilled' && supplyResult.value) {
              tokenData.tokenSupply = supplyResult.value.toString()
            }
          } catch (error) {
            console.warn('Failed to fetch token data:', error)
          }
        }

        const _ruleset = ruleset
          ? [
              { weight: +ruleset[0].weight.toString() },
              { reservedPercent: +ruleset[1].reservedPercent.toString() },
            ]
          : null

        let _backers: any[] = []
        try {
          _backers = await getBackers(
            featuredMission.projectId,
            featuredMission.id
          )
        } catch (err) {
          console.warn('Failed to fetch backers:', err)
        }

        featuredMissionData = {
          mission: featuredMission,
          _stage: stage ? +stage.toString() : 1,
          _deadline: deadline,
          _refundPeriod: refundPeriod,
          _primaryTerminalAddress: primaryTerminalAddress,
          _token: tokenData,
          _fundingGoal: featuredMission.fundingGoal || 0,
          _ruleset: _ruleset,
          _backers: _backers,
          projectMetadata: featuredMission.metadata,
        }
      } catch (error) {
        console.warn('Failed to fetch featured mission data:', error)
      }
    }

    return {
      props: {
        missions: filteredMissions,
        featuredMissionData,
      },
      revalidate: 60, // Increase revalidation time to reduce RPC calls
    }
  } catch (error) {
    console.error('Error in getStaticProps:', error)

    // Return fallback data to prevent build failure
    return {
      props: {
        missions: [
          {
            id: 'fallback-1',
            teamId: null,
            projectId: null,
            metadata: {
              name: 'MoonDAO Launchpad',
              description:
                'Welcome to the MoonDAO Launchpad. Mission data is being loaded.',
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
