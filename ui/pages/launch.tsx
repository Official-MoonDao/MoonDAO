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
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import useMissionData from '@/lib/mission/useMissionData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
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
      <section id="hero-section">
        <div id="hero-content-container" className="">
          <div
            id="hero-content"
            className="relative md:pt-0 md:pb-0 h-[45vw] md:h-[max(30vh,400px)] 2xl:h-[400px] flex justify-between items-center overflow-hidden"
          >
            <div className="relative h-full w-full 2xl:hidden">
              <video
                id="video-background-mobile"
                className="bg-[#010618] min-w-[100vw] h-full w-full object-contain object-right md:h-[max(30vh,400px)]"
                autoPlay
                loop
                muted
                playsInline
              >
                <source
                  src="/assets/moondao-video-cropped-fade-left.mp4"
                  type="video/mp4"
                />
              </video>
              <div className="absolute inset-0 bg-gradient-to-tr md:bg-gradient-to-r w-full from-[10%] from-[#010618] to-transparent"></div>
            </div>
            <div className="relative hidden 2xl:block w-full 2xl:flex 2xl:justify-end">
              <video
                id="video-background-desktop"
                className="min-w-[100vw] md:w-full object-cover 2xl:h-[400px] 2xl:object-contain 2xl:object-right 2xl:w-[100vw] bg-[#010618]"
                autoPlay
                loop
                muted
                playsInline
              >
                <source
                  src="/assets/moondao-video-san-surface.mp4"
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
                className="absolute right-[-2px] bottom-[-2px] z-0 w-[50vw] md:w-[25vw] 2xl:w-[10vw]"
                src="/assets/launchpad/blue-divider-rl.svg"
                alt="Divider"
                width={250}
                height={250}
              />
              <div
                id="logo-and-graphics-container"
                className="absolute w-full h-full md:h-auto left-[0] md:pl-[2vw] justify-center flex-col md:flex-row flex items-center md:justify-center z-[1]"
              >
                <div
                  id="graphics-container"
                  className="md:h-full flex flex-col items-center justify-center md:pb-0"
                >
                  <div
                    id="desktop-tagline-container"
                    className="w-full justify-center items-center px-[2vw] md:px-[5vw]"
                  >
                    <Image
                      id="desktop-tagline"
                      className="w-[70vw] md:w-[max(50vw,500px)] h-auto md:w-[min(70vw,650px)]"
                      src="/assets/Tagline Animation - inline centered.svg"
                      alt="Org"
                      width={450}
                      height={450}
                    />
                  </div>
                  <h1 className="font-GoodTimes text-left text-white text-[9vw] md:text-[max(3.5vw,45px)]">
                    {'Launchpad'}
                  </h1>
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
            className="w-[100vw] md:w-[15vw] 2xl:w-[35vw] "
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
          className="absolute top-[-2px] left-[-2px] w-[90vw] md:w-[35vw] 2xl:w-[40vw]"
          src="/assets/launchpad/divider-13.svg"
          alt="divider"
          width={500}
          height={500}
        />
        {missions?.[FEATURED_MISSION_INDEX]?.projectId !== undefined ? (
          <div
            id="featured-missions-container"
            className="mt-[2vw] md:mt-[1vw] pb-[5vw] mb-[2vw] md:mb-[-5vw] md:pb-0 md:pt-0 relative flex flex-col justify-center items-center md:flex-row z-20 mb-[-5vw] w-full md:max-w-[1000px] mx-auto"
          >
            <JuiceProviders
              projectId={missions?.[FEATURED_MISSION_INDEX]?.projectId || 0}
              selectedChain={selectedChain}
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
                backers={featuredMissionBackers}
                token={featuredMissionToken}
                ruleset={featuredMissionRuleset}
                subgraphData={featuredMissionSubgraphData}
                fundingGoal={featuredMissionFundingGoal}
                teamContract={teamContract}
                selectedChain={selectedChain}
                learnMore
                showMore
                compact
                linkToMission
              />
            </JuiceProviders>
          </div>
        ) : (
          <></>
        )}
      </section>

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
