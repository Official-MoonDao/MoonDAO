import { useLogin, usePrivy } from '@privy-io/react-auth'
import HatsABI from 'const/abis/Hats.json'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4DirectoryABI from 'const/abis/JBV4Directory.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  JBV4_CONTROLLER_ADDRESSES,
  JBV4_DIRECTORY_ADDRESSES,
  JBV4_TOKENS_ADDRESSES,
  MISSION_CREATOR_ADDRESSES,
  MISSION_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { blockedMissions } from 'const/whitelist'
import { GetStaticProps } from 'next'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { sepolia } from '@/lib/infura/infuraChains'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import useMissionData from '@/lib/mission/useMissionData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { truncateTokenValue } from '@/lib/utils/numbers'
import ExplainerIcon from '@/components/launchpad/ExplainerIcon'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'
import LaunchpadFAQs from '@/components/launchpad/LaunchpadFAQs'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import StandardButton from '@/components/layout/StandardButton'
import VerticalProgressScrollBar from '@/components/layout/VerticalProgressScrollBar'
import CreateMission from '@/components/mission/CreateMission'
import MissionWideCard from '@/components/mission/MissionWideCard'

const FEATURED_MISSION_INDEX = 0

export default function Launch({ missions }: any) {
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
    abi: MissionCreatorABI.abi as any,
  })

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: MissionTableABI as any,
  })

  const jbControllerContract = useContract({
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: JBV4ControllerABI as any,
  })

  const jbDirectoryContract = useContract({
    address: JBV4_DIRECTORY_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: JBV4DirectoryABI as any,
  })

  const jbTokensContract = useContract({
    address: JBV4_TOKENS_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: JBV4TokensABI as any,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    chain: selectedChain,
    abi: HatsABI as any,
  })

  const userTeams = useTeamWearer(teamContract, selectedChain, address)
  const [userTeamsAsManager, setUserTeamsAsManager] = useState<any>()

  const {
    token: featuredMissionToken,
    subgraphData: featuredMissionSubgraphData,
    fundingGoal: featuredMissionFundingGoal,
    primaryTerminalAddress: featuredMissionPrimaryTerminalAddress,
    ruleset: featuredMissionRuleset,
    stage: featuredMissionStage,
    backers: featuredMissionBackers,
    deadline: featuredMissionDeadline,
  } = useMissionData({
    mission: missions?.[FEATURED_MISSION_INDEX] || null,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
  })

  const { data: ethPrice } = useETHPrice(1)

  useEffect(() => {
    async function getUserTeamsAsManager() {
      setUserTeamsAsManager(undefined)
      const teamsAsManager = userTeams?.filter(async (team: any) => {
        if (!team?.teamId) return false
        const isManager = await readContract({
          contract: teamContract,
          method: 'isManager' as string,
          params: [team.teamId, address],
        })
        return isManager
      })
      setUserTeamsAsManager(teamsAsManager)
    }
    if (teamContract && userTeams && address) getUserTeamsAsManager()
    else setUserTeamsAsManager(undefined)
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

  if (status === 'create') {
    return (
      <CreateMission
        selectedChain={selectedChain}
        missionCreatorContract={missionCreatorContract}
        teamContract={teamContract}
        hatsContract={hatsContract}
        setStatus={setStatus}
        userTeams={userTeams}
        userTeamsAsManager={userTeamsAsManager}
      />
    )
  }

  return (
    <>
      <section className="relative h-screen overflow-hidden">
        {/* High-quality background image */}
        <div className="absolute inset-0">
          <Image
            src="/assets/Lunar-Colony.png"
            alt="Lunar base under construction with rocket launch"
            fill
            className="object-cover object-center"
            priority
            quality={100}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#010618]/80 via-[#010618]/60 to-transparent"></div>
        </div>

        {/* Hero content - positioned higher up from bottom */}
        <div className="relative z-10 h-full flex flex-col justify-end">
          <div className="px-8 md:px-12 lg:px-16 pb-16 md:pb-20 lg:pb-24">
            <div className="max-w-2xl">
              {/* MoonDAO Logo */}
              <div className="mb-6">
                <Image
                  src="/assets/Tagline Animation - inline centered.svg"
                  alt="MoonDAO"
                  width={300}
                  height={75}
                  className="w-48 md:w-64 lg:w-72"
                />
              </div>
              
              {/* Main heading */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-GoodTimes text-white mb-6 leading-tight">
                Launchpad
              </h1>
              
              {/* Description */}
              <p className="text-lg md:text-xl lg:text-2xl text-white/90 mb-8 leading-relaxed max-w-xl">
                Fund the future of space exploration with decentralized crowdfunding that connects global communities to groundbreaking missions.
              </p>
              
              {/* CTA Button - enhanced with flair */}
              <div className="flex justify-start">
                <div className="relative group">
                  {/* Glow effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Main button */}
                  <StandardButton
                    className="relative bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] text-white font-semibold text-base px-8 py-3 rounded-xl hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 border-0 backdrop-blur-sm text-center"
                    onClick={handleCreateMission}
                    hoverEffect={false}
                  >
                    <div className="flex items-center justify-center w-full text-center">
                      <span className="relative text-center pl-4">
                        Launch Your Mission
                        {/* Text glow effect */}
                        <span className="absolute inset-0 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent blur-sm opacity-50"></span>
                      </span>
                      
                      {/* Arrow icon */}
                      <svg 
                        className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300 ml-2" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </StandardButton>
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
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex flex-col items-center text-white/70 hover:text-white/90 transition-colors duration-300 cursor-pointer group">
            <span className="text-sm font-medium mb-2 tracking-wider uppercase">Scroll to explore</span>
            <div className="relative">
              {/* Animated scroll arrow */}
              <svg 
                className="w-6 h-6 animate-bounce group-hover:animate-pulse" 
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
            <div className="mt-3 w-px h-8 bg-gradient-to-b from-white/50 to-transparent"></div>
          </div>
        </div>
      </section>
      {/* Featured Mission Section - Fullscreen */}
      {missions?.[FEATURED_MISSION_INDEX]?.projectId !== undefined && (
        <section className="relative h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#1B1C4B] to-[#010618]">
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#010618]/80 via-[#1B1C4B]/60 to-[#010618]/80"></div>
          
          {/* Inspiring Mission Background */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Space-themed gradient orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-purple-500/15 to-blue-500/15 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-pink-500/15 to-purple-500/15 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl"></div>
            
            {/* Constellation-like dots */}
            <div className="absolute top-1/5 right-1/3 w-1 h-1 bg-white/40 rounded-full"></div>
            <div className="absolute top-2/5 left-1/5 w-1 h-1 bg-cyan-400/50 rounded-full"></div>
            <div className="absolute top-3/5 right-1/4 w-1 h-1 bg-purple-400/40 rounded-full"></div>
            <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-pink-400/50 rounded-full"></div>
            <div className="absolute bottom-1/4 right-1/5 w-1 h-1 bg-blue-400/40 rounded-full"></div>
            
            {/* Nebula-like swirls */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-500/5 via-transparent to-blue-500/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-pink-500/5 via-transparent to-purple-500/5 rounded-full blur-3xl"></div>
          </div>
          
          {/* Text readability overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/30"></div>
          
          {/* Featured Mission Header */}
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
            <div className="flex items-center gap-4 text-center">
              <Image
                src="/assets/spotlight.svg"
                alt=""
                width={40}
                height={40}
                className="w-8 h-8 md:w-10 md:h-10"
              />
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-GoodTimes text-white">
                Featured Mission
              </h2>
            </div>
          </div>

          {/* Mission Content - Direct Display */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
            <JuiceProviders
              projectId={missions?.[FEATURED_MISSION_INDEX]?.projectId || 0}
              selectedChain={selectedChain}
            >
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                {/* Left Column - Mission Image */}
                <div className="flex justify-center lg:justify-start order-2 lg:order-1">
                  <div className="relative w-full max-w-sm lg:max-w-md">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                      <Image
                        src={
                          getIPFSGateway(missions?.[FEATURED_MISSION_INDEX]?.metadata?.logoUri) ||
                          '/assets/project-default.png'
                        }
                        alt={missions?.[FEATURED_MISSION_INDEX]?.metadata?.name || 'Mission'}
                        width={500}
                        height={500}
                        className="w-full h-auto object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    </div>
                    
                    {/* Team Image */}
                    {missions?.[FEATURED_MISSION_INDEX]?.team?.metadata?.logoUri && (
                      <div className="absolute -bottom-4 -right-4 bg-white/10 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20">
                        <Image
                          src={getIPFSGateway(missions?.[FEATURED_MISSION_INDEX]?.team?.metadata?.logoUri)}
                          alt={missions?.[FEATURED_MISSION_INDEX]?.team?.metadata?.name || 'Team'}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Mission Info */}
                <div className="space-y-6 lg:space-y-8 order-1 lg:order-2">
                  {/* Mission Title & Tagline */}
                  <div className="space-y-3 lg:space-y-4">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-GoodTimes text-white leading-tight">
                      {missions?.[FEATURED_MISSION_INDEX]?.metadata?.name || 'Featured Mission'}
                    </h1>
                    {missions?.[FEATURED_MISSION_INDEX]?.metadata?.tagline && (
                      <p className="text-lg md:text-xl lg:text-2xl text-white/80 font-light">
                        {missions?.[FEATURED_MISSION_INDEX]?.metadata?.tagline}
                      </p>
                    )}
                  </div>

                  {/* Team Information */}
                  {missions?.[FEATURED_MISSION_INDEX]?.team && (
                    <div className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                      <div className="relative">
                        <Image
                          src={
                            getIPFSGateway(missions?.[FEATURED_MISSION_INDEX]?.team?.metadata?.logoUri) ||
                            '/assets/project-default.png'
                          }
                          alt={missions?.[FEATURED_MISSION_INDEX]?.team?.metadata?.name || 'Team'}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/60 text-sm font-medium">Launched by</span>
                        <span className="text-white font-semibold text-lg">
                          {missions?.[FEATURED_MISSION_INDEX]?.team?.metadata?.name || 'Unknown Team'}
                        </span>
                      </div>
                    </div>
                  )}



                  {/* Mission Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                    {/* Amount Raised */}
                    <div className="bg-gradient-to-br from-[#6C407D]/20 to-[#5F4BA2]/20 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white/20 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <Image
                          src="/assets/icon-raised-tokens.svg"
                          alt="Raised"
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                        <span className="text-white/70 text-sm font-medium">Raised</span>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {truncateTokenValue(Number(featuredMissionSubgraphData?.volume || 0) / 1e18, 'ETH')} ETH
                      </p>
                    </div>

                    {/* Funding Goal */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white/20 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <Image
                          src="/assets/target.png"
                          alt="Goal"
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                        <span className="text-white/70 text-sm font-medium">Goal</span>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {featuredMissionFundingGoal
                          ? truncateTokenValue(featuredMissionFundingGoal / 1e18, 'ETH')
                          : '0'} ETH
                      </p>
                    </div>

                    {/* Backers */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white/20 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <Image
                          src="/assets/icon-backers.svg"
                          alt="Backers"
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                        <span className="text-white/70 text-sm font-medium">Backers</span>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {featuredMissionBackers?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 font-medium">Funding Progress</span>
                      <span className="text-white font-bold">
                        {featuredMissionFundingGoal && featuredMissionFundingGoal > 0
                          ? Math.round((Number(featuredMissionSubgraphData?.volume || 0) / featuredMissionFundingGoal) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${featuredMissionFundingGoal && featuredMissionFundingGoal > 0
                            ? Math.min((Number(featuredMissionSubgraphData?.volume || 0) / featuredMissionFundingGoal) * 100, 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <StandardButton
                      className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] text-white font-semibold px-8 py-3 rounded-xl hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 border border-white/20 text-center"
                      onClick={() => router.push(`/mission/${missions?.[FEATURED_MISSION_INDEX]?.id}`)}
                      hoverEffect={false}
                    >
                      <span className="text-center pl-4">Learn More</span>
                    </StandardButton>
                    <StandardButton
                      className="bg-white/10 backdrop-blur-sm text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/20 transition-all duration-300 border border-white/20 text-center"
                      onClick={() => {
                        // Handle buy action
                      }}
                      hoverEffect={false}
                    >
                      <span className="text-center pl-4">
                        {featuredMissionToken?.symbol ? `Buy ${featuredMissionToken.symbol}` : 'Contribute'}
                      </span>
                    </StandardButton>
                  </div>
                </div>
              </div>
            </JuiceProviders>
          </div>

          {/* Decorative elements */}
          <Image
            src="/assets/launchpad/blue-divider-rl.svg"
            alt=""
            width={200}
            height={200}
            className="absolute bottom-0 right-0 w-32 md:w-48 opacity-50"
          />
          <Image
            src="/assets/launchpad/divider-13.svg"
            alt=""
            width={200}
            height={200}
            className="absolute top-0 left-0 w-32 md:w-48 opacity-50"
          />
        </section>
      )}

      <section
        id="launchpad-features-section"
        className="relative px-[5vw] 2xl:px-[10vw] pt-[2vw] md:pt-[2vw] pb-[5vw] md:pb-[2vw] md:pb-[5vw] flex flex-col bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black"
      >
        <div className="absolute top-0 left-0 hidden md:block">
          <Image
            className="w-[20vw] 2xl:w-[40vw]"
            src="/assets/navy-blue-divider-tl.svg"
            alt="Divider"
            width={200}
            height={200}
          />
        </div>
        <div className="absolute bottom-[-0.5px] left-0">
          <Image
            className="w-[30vw] md:w-[10vw] 2xl:w-[10vw] -scale-y-100"
            src="/assets/navy-blue-divider-tl.svg"
            alt="Divider"
            width={200}
            height={200}
          />
        </div>
        <div className="flex flex-col pb-[5vw] md:pb-[2vw] md:items-center">
          <h2 className="mt-[5vw] pb-[2vw] md:pb-0 md:mt-[5vw] font-GoodTimes text-[6vw] md:text-[max(2vw,25px)] 2xl:text-[35px] md:text-center leading-[7vw]">
            {'New Space Needs New Funding Tools'}
          </h2>
          <p className="md:text-center md:max-w-[500px] lg:max-w-[650px] 2xl:max-w-[800px] md:text-[max(1.2vw,16px)] 2xl:text-[18px] pb-[5vw] md:pb-[2vw]">
            {
              'Join a revolution in space funding. Unlike traditional fundraising, where contributions disappear into a black hole, we ensure your support is secure, transparent, and impactful.'
            }
          </p>
          <StandardButton
            id="launch-mission-button-1"
            className="md:text-[1.2vw] gradient-2 rounded-full"
            onClick={handleCreateMission}
            hoverEffect={false}
          >
            {'Launch Your Mission'}
          </StandardButton>
        </div>
        <div className="w-full flex flex-col md:flex-row items-start justify-between">
          <FeatureIcon
            title="Contribute"
            description="Fund with your debit card, even if you've never used crypto. Get refunded if a mission fails to reach its funding goal."
            icon="/assets/icon-crowdfunding.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#6C407D] to-[#5F4BA2]"
          />
          <FeatureIcon
            title="Coordinate"
            description="Contributions earn mission tokens that give you a stake in the journey, allowing you to help shape and govern the outcome."
            icon="/assets/icon-fasttrack.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5F4BA2] to-[#5159CC]"
          />
          <FeatureIcon
            title="Validate"
            description="Secured by code, not promises. 100% transparent use of funds onchain, allowing contributors to trace how funds were spent."
            icon="/assets/icon-lightbulb.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5159CC] to-[#4660E7]"
          />
        </div>
      </section>

      <section
        id="moondao-success-section"
        className="relative px-[5vw] 2xl:px-[10vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-t from-[#010618] to-[#1B1C4B]"
      >
        <Image
          className="w-[35vw] max-w-[800px] hidden md:block absolute top-[-1px] right-0"
          src="/assets/launchpad/offwhite-divider-rl-inverted.svg"
          alt="Divider"
          width={500}
          height={500}
        />
        <div className="flex relative flex-col md:flex-row justify-between items-center">
          <div className="flex flex-col pt-[5vw] md:pt-[5vw] mr-[5vw] md:mr-0 ">
            <h2 className="text-[5vw] md:text-[2vw] font-GoodTimes">
              {'Success Stories'}
            </h2>
            <p className="md:text-[max(1.2vw,16px)] 2xl:text-[18px] pr-0 md:pr-[5vw] pb-[2vw] md:pb-0">
              {
                "MoonDAO is no stranger to launching bold ideas. With over Ξ2,623 (+$8,000,000) crowdraised, we sent two people to space and supported 80+ projects with our funding model. We're proving that the future of space funding is decentralized and onchain."
              }
            </p>

            <div
              id="video-container"
              className="z-10 relative w-full aspect-video mt-[2vw]"
            >
              <iframe
                className="absolute top-0 left-0 w-full h-full rounded-[20px]"
                src="https://www.youtube.com/embed/mKEsUq1qxDs?si=2HQxnPsCMpT_Gpx9&amp;start=46&rel=0"
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
          <div
            id="astronauts-container"
            className="min-w-[30vw] h-auto z-10 md:z-0"
          >
            <div className="md:absolute z-20 top-0 right-0 md:w-[36vw]">
              <Image
                id="astronauts"
                className="h-full w-full top-0 p-2 md:p-5"
                src="/assets/launchpad/astronauts-v2.png"
                alt="MoonDAO Astronauts, Dr.Eiman Jahangir and Coby Cotton of Dude Perfect"
                width={500}
                height={500}
              />
            </div>
          </div>
        </div>
        <Image
          className="absolute w-[100vw] md:w-[50vw] max-w-[800px] bottom-[-2px] left-[-2px] z-0"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="Divider"
          width={850}
          height={850}
        />
      </section>

      <section
        id="how-launchpad-works"
        className="relative px-[5vw] pb-24 flex flex-col items-center gap-12 bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black"
      >
        <div className="absolute top-0 right-0 hidden md:block">
          <Image
            className="w-[10vw] 2xl:w-[10vw]"
            src="/assets/blue-divider-tr.svg"
            alt="Divider"
            width={200}
            height={200}
          />
        </div>
        <div className="w-full mt-8 flex flex-col gap-2 items-center">
          <h1 className="mt-8 text-[5vw] md:text-[max(3vw,35px)] font-GoodTimes">
            {'Mission Countdown'}
          </h1>
        </div>

        <div className="w-full md:max-w-[70vw] ">
          <div className="absolute hidden md:block h-full max-h-[65%] md:left-1/2 md:transform md:-translate-x-1/2 mt-[2vw]">
            <VerticalProgressScrollBar sectionId="how-launchpad-works" />
          </div>
          <div className="w-full flex flex-col items-end md:items-start">
            <ExplainerIcon
              title="Explore"
              subtext=""
              description="Discover missions from Teams within the Space Acceleration Network — a global network of builders, scientists, and dreamers working to accelerate our multiplanetary future."
              icon={<p>3</p>}
              numberBackground="bg-gradient-to-br from-[#6C407D] to-[#5F4BA2]"
            />
            <div className="relative md:-top-[270px] w-full flex justify-end">
              <ExplainerIcon
                title="Support"
                subtext=""
                description="Contribute in ETH (yes, even with a debit card) to missions you believe in. Funds go to the Team's multisig, and you receive mission tokens in return, a gateway to future utility and participation."
                icon={<p>2</p>}
                numberBackground="bg-gradient-to-br from-[#5F4BA2] to-[#5159CC]"
              />
            </div>
            <div className="relative md:-top-[550px] w-full">
              <ExplainerIcon
                title="Accelerate"
                subtext=""
                description="Contributions fuel real progress — from hardware to human spaceflight, research to education. You're not just backing a mission — you're joining one."
                icon={<p>1</p>}
                numberBackground="bg-gradient-to-br from-[#5159CC] to-[#4660E7]"
              />
            </div>
          </div>
          <div className="w-full flex flex-col text-center items-center justify-center gap-4 md:mt-[-475px]">
            <h3 className="hidden md:block font-GoodTimes text-[4vw] md:text-[max(1.5vw,25px)] md:pb-[1vw]">
              Your tools, your team, your mission
            </h3>
            <p className="hidden md:block text-[max(1.2vw,16px)] 2xl:text-[18px] max-w-[500px]">
              Move at the speed of the Internet. Teams using these tools have
              raised millions of dollars from all over the world in mere days.
            </p>
            <StandardButton
              id="launch-mission-button-2"
              className="gradient-2 rounded-full md:text-[min(1.2vw,25px)]"
              hoverEffect={false}
              onClick={handleCreateMission}
            >
              {'Launch Your Mission'}
            </StandardButton>
          </div>
        </div>

        <Image
          className="absolute bottom-[-1px] -left-[1px] -scale-x-100"
          src="/assets/launchpad/blue-divider-rl.svg"
          alt="Divider"
          width={250}
          height={250}
        />
      </section>

      <section id="benefits-section" className="relative">
        <div className="pt-[10vw] md:pt-0 pb-[5vw] md:pb-0 justify-center relative flex flex-col items-center bg-gradient-to-b from-[#010618] from-[0%] md:from-[5%] to-[#1B1C4B] to-[100%] md:to-[60%]">
          <div className="absolute top-0 right-0 hidden md:block">
            <Image
              className="w-[10vw] 2xl:w-[10vw]"
              src="/assets/white-divider-tr.svg"
              alt="Divider"
              width={200}
              height={200}
            />
          </div>
          <div className="relative z-10">
            <LaunchpadBenefit
              title="Global Access"
              description="Tap into a global crypto network with trillions of dollars at your fingertips."
              icon="/assets/icon-globe.svg"
              align="left"
              slideDirection="left"
            />
          </div>
          <Image
            className="absolute bottom-0 left-0 -scale-x-100 z-[1]"
            src="/assets/launchpad/blue-divider-rl.svg"
            alt="Divider"
            width={500}
            height={500}
          />
        </div>
        <div
          id="featured-project-section"
          className="relative px-[5vw] 2xl:px-[10vw] overflow-hidden flex flex-col gap-12 bg-gradient-to-b from-[#010618] from-[0%] md:from-[40%] to-[#0C0F28] to-[100%] md:to-[60%]"
        >
          <div className="relative z-10">
            <LaunchpadBenefit
              title="Trustless"
              description="All transactions are onchain, ensuring that everyone can see how funds are spent."
              icon="/assets/icon-signature.svg"
              align="right"
              slideDirection="right"
            />
          </div>
        </div>
        <div className="pt-[10vw] md:pt-0 pb-[5vw] md:pb-0 justify-center relative flex flex-col items-center bg-gradient-to-t from-[#010618] from-[0%] md:from-[5%] to-[#1B1C4B] to-[100%] md:to-[60%]">
          <Image
            className="absolute top-0 left-0 z-[1]"
            src="/assets/launchpad/blue-divider-lr-inverted.svg"
            alt="Divider"
            width={500}
            height={500}
          />
          <div className="relative z-10">
            <LaunchpadBenefit
              title="Battle Tested"
              description="Powered by Juicebox, a proven and audited platform with over 1,000+ projects and over $200,000,000+ raised."
              icon="/assets/icon-checkmark.svg"
              align="left"
              slideDirection="left"
            />
          </div>
          <div className="relative z-10">
            <LaunchpadBenefit
              title="Scalable"
              description="Adapt your fundraising strategy as your mission evolves with our quick launch guidelines and templates."
              icon="/assets/icon-scalable.svg"
              align="right"
              slideDirection="right"
            />
          </div>
          <Image
            className="absolute bottom-0 right-0 z-[1]"
            src="/assets/launchpad/blue-divider-rl.svg"
            alt="Divider"
            width={500}
            height={500}
          />
        </div>
        <div
          id="featured-project-section"
          className="relative px-[5vw] 2xl:px-[10vw] pb-[5vw] overflow-hidden flex flex-col gap-12 bg-gradient-to-b from-[#010618] from-[0%] md:from-[40%] to-[#0C0F28] to-[100%] md:to-[60%]"
        >
          <div className="relative z-10">
            <LaunchpadBenefit
              title="Power of the Network"
              description="The Space Acceleration Network brings leading space companies, enthusiasts, and professionals onchain from around the globe."
              icon="/assets/icon-powerful.svg"
              align="left"
              slideDirection="left"
            />
          </div>
        </div>

        <Image
          className="absolute bottom-0 right-0 w-[40vw] md:w-[25vw] z-[1]"
          src="/assets/launchpad/gradient-divider-rl.png"
          alt="Divider"
          width={300}
          height={300}
        />
      </section>

      <section
        id="final-callout-section"
        className="relative px-[5vw] 2xl:px-[10vw] py-[5vw] md:py-[2vw] flex flex-col start bg-gradient-to-bl from-[#6D3F79] to-[#435EEB] from-20% to-[80%]"
      >
        <div className="flex flex-col md:flex-row items-center justify-center">
          <Image
            src="/assets/MoonDAO-Logo-White.svg"
            alt="MoonDAO Logo"
            width={550}
            height={550}
            className="w-[60vw] md:w-[min(20vw,250px)] md:pb-0 pb-[5vw] self-center"
          />
          <div className="flex flex-col justify-center pb-[5vw] md:pb-0 md:ml-[2vw]">
            <h3 className="text-white text-[5vw] md:text-[2vw] font-GoodTimes">
              {'Get Started Today'}
            </h3>
            <p className="text-white pb-[2vw] text-[max(1.2vw,16px)] 2xl:text-[18px] md:max-w-[500px]">
              {
                'The next great space mission starts here. Join the decentralized space race and fund your mission with the Launchpad. The Launchpad is available permissionlessly to teams in the Space Acceleration Network.'
              }
            </p>
            <StandardButton
              id="launch-mission-button-3"
              className="md:text-[1.2vw] bg-[#FFFFFF] rounded-full w-[60vw] md:w-[20vw]"
              textColor="text-black"
              onClick={handleCreateMission}
              hoverEffect={false}
            >
              {'Launch Your Mission'}
            </StandardButton>
          </div>
        </div>
      </section>

      <section
        id="faq-section-content"
        className="bg-white text-black px-[5vw] 2xl:px-[10vw] w-full relative"
      >
        <Image
          src="/assets/launchpad/gradient-blue-divider-lr-inverted.svg"
          alt="divider"
          width={75}
          height={75}
          className="z-[1] w-[30vw] absolute top-[-2px] left-[-2px]"
        />
        <div id="faq-content" className="z-[10] relative py-[5vw]">
          <div
            id="faq-title"
            className="flex flex-row items-center gap-[2vw] mb-[5vw] md:mb-[2vw]"
          >
            <Image
              src="/assets/launchpad/question-mark.svg"
              alt="Question Mark"
              width={75}
              height={75}
              className="w-[20vw] md:w-[min(10vw,100px)]"
            />
            <h3 className="text-[5vw] md:text-[min(3vw,25px)] font-GoodTimes">
              {'Frequently Asked Questions'}
            </h3>
          </div>
          <LaunchpadFAQs />
        </div>
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

export const getStaticProps: GetStaticProps = async () => {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missionTableContract = getContract({
      client: serverClient,
      address: MISSION_TABLE_ADDRESSES[chainSlug],
      abi: MissionTableABI as any,
      chain: chain,
    })

    const missionTableName = await readContract({
      contract: missionTableContract,
      method: 'getTableName' as string,
      params: [],
    })

    const statement = `SELECT * FROM ${missionTableName}`

    const missionRows = await queryTable(chain, statement)

    const filteredMissionRows = missionRows.filter((mission) => {
      return !blockedMissions.includes(mission.id) && mission && mission.id
    })

    const jbV4ControllerContract = getContract({
      client: serverClient,
      address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
      abi: JBV4ControllerABI as any,
      chain: chain,
    })

    // Process missions with rate limiting protection
    const missions = await Promise.all(
      filteredMissionRows.map(async (missionRow, index) => {
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
            contract: jbV4ControllerContract,
            method: 'uriOf' as string,
            params: [missionRow.projectId],
          })

          const metadataRes = await fetch(getIPFSGateway(metadataURI))
          const metadata = await metadataRes.json()

          return {
            id: missionRow.id,
            teamId: missionRow.teamId,
            projectId: missionRow.projectId,
            metadata: metadata,
          }
        } catch (error) {
          console.warn(`Failed to fetch mission ${missionRow?.id}:`, error)
          return {
            id: missionRow?.id || `fallback-${index}`,
            teamId: missionRow?.teamId || null,
            projectId: missionRow?.projectId || null,
            metadata: {
              name: 'Mission Unavailable',
              description: 'This mission is temporarily unavailable.',
              image: '/assets/placeholder-mission.png',
            },
          }
        }
      })
    )

    return {
      props: {
        missions: missions.filter((mission) => mission !== null),
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
      },
      revalidate: 60,
    }
  }
}
