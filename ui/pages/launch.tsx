import { useLogin, usePrivy } from '@privy-io/react-auth'
import HatsABI from 'const/abis/Hats.json'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4DirectoryABI from 'const/abis/JBV4Directory.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import MissionCreatorSepABI from 'const/abis/MissionCreatorSep.json'
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
import React, { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { sepolia } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import useMissionData from '@/lib/mission/useMissionData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import ExplainerIcon from '@/components/launchpad/ExplainerIcon'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'
import LaunchpadFAQs from '@/components/launchpad/LaunchpadFAQs'
import Footer from '@/components/layout/Footer'
import StandardButton from '@/components/layout/StandardButton'
import VerticalProgressScrollBar from '@/components/layout/VerticalProgressScrollBar'
import CreateMission from '@/components/mission/CreateMission'
import MissionWideCard from '@/components/mission/MissionWideCard'

const FEATURED_MISSION_INDEX = 0

export default function Launch({ missions }: any) {
  const [status, setStatus] = useState<
    'idle' | 'loggingIn' | 'apply' | 'create'
  >('idle')

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

  // const { selectedChain } = useContext(ChainContextV5)
  const selectedChain = sepolia
  const chainSlug = getChainSlug(selectedChain)

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: TeamABI as any,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi:
      chainSlug === 'sepolia'
        ? (MissionCreatorSepABI as any)
        : (MissionCreatorABI as any),
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
  } = useMissionData({
    mission: missions?.[FEATURED_MISSION_INDEX],
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
  })

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
      <section id="hero-section">
        <div id="hero-content-container" className="">
          <div
            id="hero-content"
            className="relative md:pt-0 md:pb-0 h-[80vw] md:h-[max(45vh,600px)] 2xl:h-[max(45vh,550px)] flex justify-between items-center overflow-hidden"
          >
            <div className="relative h-full w-full 2xl:hidden">
              <video
                id="video-background-mobile"
                className="min-w-[100vw] h-full w-full object-cover md:h-[max(45vh,600px)]"
                autoPlay
                loop
                muted
                playsInline
              >
                <source src="/assets/moondao-video-hero.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-tr md:bg-gradient-to-r  from-[10%] from-[#010618] to-transparent"></div>
            </div>
            <div className="relative hidden 2xl:block">
              <video
                id="video-background-desktop"
                className="min-w-[100vw] md:w-full object-cover 2xl:h-[max(45vh,550px)]"
                autoPlay
                loop
                muted
                playsInline
              >
                <source
                  src="/assets/moondao-video-hero_wide.mp4"
                  type="video/mp4"
                />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#010618] to-transparent opacity-80"></div>
            </div>
            <div
              id="content-container"
              className="flex items-center overflow-hidden"
            >
              <Image
                id="hero-divider-bottom-right"
                className="absolute right-[-2px] bottom-[-2px] z-0 w-[50vw] md:w-[30vw]"
                src="/assets/launchpad/blue-divider-rl.svg"
                alt="Divider"
                width={250}
                height={250}
              />
              <div
                id="logo-and-graphics-container"
                className="absolute w-full h-full md:h-auto left-[0] md:pl-[2vw] justify-center flex-col md:flex-row flex items-center md:justify-center z-[1]"
              >
                <div id="logo-container">
                  <Image
                    id="desktop-logo"
                    className="hidden md:flex w-[min(30vw,350px)] h-[min(30vw,350px)] 2xl:ml-[-1.5vw]"
                    src="/assets/MoonDAO Animated Logo - Original.svg"
                    alt="Logo"
                    width={250}
                    height={250}
                  />
                  <Image
                    id="mobile-logo"
                    className="md:hidden w-[30vw] sm:w-[min(35vw,450px)] sm:h-[min(35vw,450px)] md:w-auto"
                    src="/assets/MoonDAO Animated Logo - White.svg"
                    alt="Logo"
                    width={550}
                    height={550}
                  />
                </div>
                <div
                  id="graphics-container"
                  className="md:h-full flex flex-col items-center lg:items-start md:items-left justify-center md:pb-0"
                >
                  <div
                    id="desktop-title-container"
                    className="hidden md:flex items-start justify-start"
                  >
                    <Image
                      id="desktop-title"
                      src="/assets/MoonDAOLaunchpad.svg"
                      alt="MoonDAO Launchpad"
                      width={500}
                      height={150}
                      className="w-[min(40vw,450px)]"
                    />
                  </div>
                  <div id="mobile-title-container" className="md:hidden">
                    <Image
                      id="mobile-title"
                      src="/assets/MoonDAOLaunchpadCentered.svg"
                      alt="MoonDAO Launchpad"
                      width={500}
                      height={150}
                      className="w-[40vw]"
                    />
                  </div>
                  <div
                    id="desktop-tagline-container"
                    className="hidden w-full md:flex justify-center items-center"
                  >
                    <Image
                      id="desktop-tagline"
                      className="w-[90vw] h-auto md:w-[min(40vw,450px)]"
                      src="/assets/Launchpad-Tagline-Desktop.svg"
                      alt="Org"
                      width={450}
                      height={450}
                    />
                  </div>
                  <div
                    id="mobile-tagline-container"
                    className="ml-[5vw] mb-[5vw] w-full md:hidden justify-center items-center"
                  >
                    <Image
                      id="mobile-tagline"
                      className="w-[min(100vw,450px)] sm:h-[min(17vw,450px)] md:w-[40vw] md:h-[6.86vw]"
                      src="/assets/Tagline Animation - Mobile.svg"
                      alt="Org"
                      width={450}
                      height={450}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="initial-callout-section"
        className="z-10 overflow-visible relative px-[5vw] flex flex-row items-center justify-center text-center pt-[5vw] md:pt-[2vw] lg:pt-[0px] pb-[2vw] lg:pb-[0px] md:pb-[2vw] gap-4 md:gap-4 bg-gradient-to-b md:bg-gradient-to-l from-[#010618] from-[0%] md:from-[20%] to-[#1B1C4B] to-[100%] md:to-[60%]"
      >
        <div className="flex flex-row items-center gap-4">
          <Image
            id="spotlight-icon"
            src="/assets/spotlight.svg"
            alt="Spotlight Icon"
            width={100}
            height={100}
            className="z-20 w-[10vw] md:w-[min(3vw,80px)]"
          />
          <p
            id="callout"
            className="z-20 text-white font-GoodTimes text-[5vw] md:text-[max(2vw,35px)] leading-[6vw]"
          >
            {'Mission Spotlight'}
          </p>
        </div>
        <div className="absolute overflow-visible top-0 left-0">
          <Image
            src="/assets/blue-divider-tl.svg"
            alt="divider-element"
            width={100}
            height={100}
            className="w-[100vw] md:w-[15vw] 2xl:w-[20vw]"
          />
        </div>
      </section>

      <section
        id="featured-project-section"
        className="relative px-[5vw] overflow-visible flex flex-col gap-12 bg-gradient-to-b from-[#010618] to-[#1B1C4B]"
      >
        <Image
          id="white-divider-bottom-right"
          className="absolute bottom-[-2px] right-[-2px] -scale-x-100 w-[80vw] md:w-[20vw]"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="divider"
          width={500}
          height={500}
        />
        <Image
          id="blue-divider-top-left"
          className="absolute top-[-2px] left-[-2px] w-[90vw] md:w-[35vw]"
          src="/assets/launchpad/divider-13.svg"
          alt="divider"
          width={500}
          height={500}
        />
        <div
          id="featured-missions-container"
          className="mt-[2vw] md:mt-[1vw] pb-[5vw] mb-[2vw] md:mb-[-5vw] md:pb-0 md:pt-0 relative flex flex-col justify-center items-center md:flex-row z-20 mb-[-5vw] w-full md:max-w-[1000px] mx-auto"
        >
          <MissionWideCard
            mission={
              {
                ...missions?.[FEATURED_MISSION_INDEX],
                metadata: {
                  ...missions?.[FEATURED_MISSION_INDEX]?.metadata,
                  description: '',
                },
              } as any
            }
            stage={featuredMissionStage}
            token={featuredMissionToken}
            ruleset={featuredMissionRuleset}
            subgraphData={featuredMissionSubgraphData}
            fundingGoal={featuredMissionFundingGoal}
            teamContract={teamContract}
            jbDirectoryContract={jbDirectoryContract}
            primaryTerminalAddress={featuredMissionPrimaryTerminalAddress}
            selectedChain={selectedChain}
            contribute
            showMore
            compact
            linkToMission
          />
        </div>
      </section>

      <section
        id="launchpad-features-section"
        className="relative px-[5vw] 2xl:px-[10vw] pt-[2vw] md:pt-[2vw] pb-[5vw] md:pb-[2vw] md:pb-[5vw] flex flex-col bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black"
      >
        <div className="absolute top-0 left-0 hidden md:block">
          <Image
            className="w-[20vw] 2xl:w-[30vw]"
            src="/assets/navy-blue-divider-tl.svg"
            alt="Divider"
            width={200}
            height={200}
          />
        </div>
        <div className="absolute bottom-[-2px] left-0">
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
            {'New Funding Tools for New Space'}
          </h2>
          <p className="md:text-center md:max-w-[500px] lg:max-w-[650px] 2xl:max-w-[800px] md:text-[max(1.2vw,16px)] 2xl:text-[18px] pb-[5vw] md:pb-[2vw]">
            {
              'Join a revolution in space funding. Unlike traditional fundraising, where contributions disappear into a black hole, we ensure your support is secure, transparent, and impactful.'
            }
          </p>
          <StandardButton
            className="md:text-[1.2vw] gradient-2 rounded-full"
            onClick={handleCreateMission}
          >
            {'Launch Your Mission'}
          </StandardButton>
        </div>
        <div className="w-full flex flex-col md:flex-row items-start justify-between">
          <FeatureIcon
            title="Contribute Confidently"
            description="If a mission doesn't reach at least 20% of its goal within 28 days, you automatically get refunded."
            icon="/assets/icon-crowdfunding.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#6C407D] to-[#5F4BA2]"
          />
          <FeatureIcon
            title="Coordinate Effectively"
            description="Mission tokens give you a stake in the journey, allowing you to help shape and govern the treasury."
            icon="/assets/icon-fasttrack.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5F4BA2] to-[#5159CC]"
          />
          <FeatureIcon
            title="Collaborate Transparently"
            description="100% transparent funding, managed by smart contracts, so your contribution is secure."
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
                src="/assets/astronauts.png"
                alt="MoonDAO Astronauts, Dr.Eiman Jahangir and Coby"
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
            {'Mission Trajectory'}
          </h1>
        </div>

        <div className="w-full md:max-w-[70vw] ">
          <div className="absolute hidden md:block h-full max-h-[50%] md:left-1/2 md:transform md:-translate-x-1/2 mt-[2vw] pb-[0vw]">
            <VerticalProgressScrollBar sectionId="how-launchpad-works" />
          </div>
          <div className="w-full flex flex-col items-end md:items-start">
            <ExplainerIcon
              title="Ignition"
              subtext="2,000 Tokens <br/>per 1 ETH (4x)"
              description="If the mission doesn't reach 20% of its goal in 28 days, all contributions are refunded—maximizing reward while minimizing risk."
              icon={<p>1</p>}
              numberBackground="bg-gradient-to-br from-[#6C407D] to-[#5F4BA2]"
            />
            <div className="relative md:-top-[270px] w-full flex justify-end">
              <ExplainerIcon
                title="Ascent"
                subtext="1,000 Tokens <br/>per 1 ETH (2x)"
                description="With minimum funding secured, the mission has launched and is ascending toward its goal. Contributors now join with confidence, knowing the mission will proceed."
                icon={<p>2</p>}
                numberBackground="bg-gradient-to-br from-[#5F4BA2] to-[#5159CC]"
              />
            </div>
            <div className="relative md:-top-[550px] w-full">
              <ExplainerIcon
                title="Orbit"
                subtext="500 Tokens <br/>per 1 ETH (1x)"
                description="With full funding achieved, rewards adjust to reflect lower risk. Contributions now fuel expansion, stretch goals, and long-term impact."
                icon={<p>3</p>}
                numberBackground="bg-gradient-to-br from-[#5159CC] to-[#4660E7]"
              />
            </div>
          </div>
          <div className="w-full flex flex-col text-center items-center justify-center gap-4 md:mt-[-400px]">
            <h3 className="font-GoodTimes text-[4vw] md:text-[max(1.5vw,25px)] md:pb-[1vw]">
              Your tools, your team, your mission
            </h3>
            <StandardButton
              className="gradient-2 rounded-full md:text-[min(1.2vw,25px)]"
              hoverEffect={false}
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
              description="Move at the speed of the internet tapping into a global crypto network with trillions of dollars at your fingertips."
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
                'The next great space mission starts here. Join the decentralized space race and fund your mission with the MoonDAO Launchpad. The Launchpad is available permissionlessly to teams in the Space Acceleration Network.'
              }
            </p>
            <StandardButton
              className="md:text-[1.2vw] bg-[#FFFFFF] rounded-full w-[60vw] md:w-[20vw]"
              textColor="text-black"
              onClick={handleCreateMission}
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
      <div className="bg-[#020617]">
        <Footer darkBackground={true} />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const chain = sepolia
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

  const statement = `SELECT * FROM ${missionTableName} LIMIT 10`

  const missionRows = await queryTable(chain, statement)

  const filteredMissionRows = missionRows.filter((mission) => {
    return !blockedMissions.includes(mission.id)
  })

  const jbV4ControllerContract = getContract({
    client: serverClient,
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    abi: JBV4ControllerABI as any,
    chain: chain,
  })

  const missions = await Promise.all(
    filteredMissionRows.map(async (missionRow) => {
      const metadataURI = await readContract({
        contract: jbV4ControllerContract,
        method: 'uriOf' as string,
        params: [missionRow.projectId],
      })

      const metadataRes = await fetch(
        `https://ipfs.io/ipfs/${metadataURI.replace('ipfs://', '')}`
      )
      const metadata = await metadataRes.json()

      return {
        id: missionRow.id,
        teamId: missionRow.teamId,
        projectId: missionRow.projectId,
        metadata: metadata,
      }
    })
  )

  return {
    props: {
      missions,
    },
    revalidate: 60,
  }
}
