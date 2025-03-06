import { useLogin, usePrivy } from '@privy-io/react-auth'
import HatsABI from 'const/abis/Hats.json'
import JBV4ControllerABI from 'const/abis/JBV4Controller.json'
import JBV4TokensABI from 'const/abis/JBV4Tokens.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  JBV4_CONTROLLER_ADDRESSES,
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
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import FAQ, { FAQProvider } from '@/components/launchpad/FAQ'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'
import CardStack from '@/components/layout/CardStack'
import StandardButton from '@/components/layout/StandardButton'
import VerticalProgressScrollBar from '@/components/layout/VerticalProgressScrollBar'
import CreateMission from '@/components/mission/CreateMission'

export default function Launch({ missions }: any) {
  const router = useRouter()

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
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const [missionApplyModalEnabled, setMissionApplyModalEnabled] =
    useState(false)

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: TeamABI as any,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: MissionCreatorABI as any,
  })

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    chain: selectedChain,
    abi: HatsABI as any,
  })

  const jbControllerContract = useContract({
    address: JBV4_CONTROLLER_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: JBV4ControllerABI as any,
  })

  const jbTokensContract = useContract({
    address: JBV4_TOKENS_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: JBV4TokensABI as any,
  })

  const userTeams = useTeamWearer(teamContract, selectedChain, address)
  const [userTeamsAsManager, setUserTeamsAsManager] = useState<any>()

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
        userTeamsAsManager={userTeamsAsManager}
      />
    )
  }

  return (
    <>
      <section id="🌌hero-section">
        <div id="hero-content-container" className="">
          <div
            id="hero-content"
            className="relative pt-[10vw] md:pt-0 pb-[5vw] md:pb-0 md:h-[max(30vh,300px)] lg:h-[max(80vh,650px)] flex justify-between items-center overflow-hidden"
          >
            <div className="relative">
              <video
                id="video-background"
                className="min-w-[100vw] md:w-full object-cover md:h-[max(40vh,400px)] lg:h-[max(80vh,650px)] object-right"
                autoPlay
                loop
                muted
                playsInline
              >
                <source src="/assets/moondao-video-hero.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#010618] to-transparent opacity-80"></div>
            </div>
            <div
              id="content-container"
              className="flex items-center overflow-hidden"
            >
              <Image
                id="hero-divider-bottom-right"
                className="absolute right-[-2px] bottom-[-2px] z-[10] w-[50vw] md:w-[30vw]"
                src="/assets/launchpad/blue-divider-rl.svg"
                alt="Divider"
                width={250}
                height={250}
              />
              <div
                id="logo-and-graphics-container"
                className="absolute w-full h-full md:h-auto left-[0] md:pl-[2vw] justify-end flex-col md:flex-row flex items-center md:justify-start z-[10]"
              >
                <div id="logo-container">
                  <Image
                    id="desktop-logo"
                    className="hidden md:flex w-[30vw] h-[30vw] md:w-auto"
                    src="/assets/MoonDAO Animated Logo - Original.svg"
                    alt="Logo"
                    width={250}
                    height={250}
                  />
                  <Image
                    id="mobile-logo"
                    className="md:hidden w-[30vw] h-[30vw] md:w-auto"
                    src="/assets/MoonDAO Animated Logo - White.svg"
                    alt="Logo"
                    width={250}
                    height={250}
                  />
                </div>
                <div
                  id="graphics-container"
                  className="md:h-full flex flex-col items-center md:items-left justify-center pb-[5vw] md:pb-0"
                >
                  <div id="desktop-title-container" className="hidden md:flex">
                    <Image
                      id="desktop-title"
                      src="/assets/MoonDAOLaunchpad.svg"
                      alt="MoonDAO Launchpad"
                      width={500}
                      height={150}
                      className="w-[40vw]"
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
                      className="w-[90vw] h-[17vw] md:w-[40vw] md:h-[6.86vw]"
                      src="/assets/Animated-Icon-Tagline.svg"
                      alt="Org"
                      width={450}
                      height={450}
                    />
                  </div>
                  <div
                    id="mobile-tagline-container"
                    className="ml-[5vw] w-full md:hidden justify-center items-center"
                  >
                    <Image
                      id="mobile-tagline"
                      className="w-[90vw] h-[17vw] md:w-[40vw] md:h-[6.86vw]"
                      src="/assets/Tagline Animation Centered.svg"
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
        className="px-[5vw] md:px-[2vw] flex flex-col md:flex-row items-center justify-center pt-[10vw] md:pt-[2vw] pb-[10vw] md:pb-[2vw] gap-4 md:gap-12 bg-gradient-to-b md:bg-gradient-to-l from-[#010618] from-[0%] md:from-[40%] to-[#1B1C4B] to-[100%] md:to-[60%]"
      >
        <p
          id="callout"
          className="text-white text-lg font-GoodTimes text-[5vw] md:text-[2vw] text-center leading-[6vw]"
        >
          {'Launch Your Space Mission With MoonDAO'}
        </p>
        <StandardButton
          className="gradient-2 rounded-full md:text-[1.2vw]"
          hoverEffect={false}
          onClick={handleCreateMission}
        >
          {'Launch Your Mission'}
        </StandardButton>
      </section>

      <section
        id="🐭featured-project-section"
        className="relative px-[5vw] pb-[5vw] overflow-hidden flex flex-col gap-12 bg-gradient-to-b from-[#010618] to-[#1B1C4B]"
      >
        <Image
          id="white-divider-bottom-right"
          className="absolute bottom-[-2px] right-[-2px] -scale-x-100 w-[20vw]"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="divider"
          width={500}
          height={500}
        />
        <Image
          id="blue-divider-top-left"
          className="absolute top-[-2px] left-[-2px] w-[90vw] md:w-[40vw]"
          src="/assets/launchpad/divider-13.svg"
          alt="divider"
          width={500}
          height={500}
        />
        <div
          id="featured-image-container"
          className="pb-[5vw] md:pb-0 pt-[5vw] md:pt-0 relative flex flex-col items-center md:flex-row gap-12"
        >
          <div
            id="featured-image-container"
            className="md:ml-0 relative w-[80vw] md:w-[max(40vw,450px)]"
          >
            <Image
              id="featured-image-frame"
              className="absolute top-0 right-0 z-20 w-full h-full"
              src="/assets/launchpad/image-frame-1.svg"
              alt="Image Frame 1"
              width={315}
              height={315}
            />
            <Image
              id="featured-image"
              className="z-10 w-full h-full"
              src="/assets/launchpad/space-mice.png"
              alt="Astro"
              width={300}
              height={300}
            />
          </div>
          <div
            id="featured-text-container"
            className="w-full h-auto flex justify-center flex-col"
          >
            <h2 className="text-white font-GoodTimes text-[5vw] md:text-[2vw] md:pb-[1vw]">
              {'Save the Space Mice!'}
            </h2>
            <p className="md:text-[1.2vw] pb-[2vw]">
              {
                "Join the first onchain fundraising platform designed exclusively for space missions. MoonDAO's Launch Pad empowers teams to raise funds transparently, manage their treasuries independently, and take their space exploration ideas from concept to fully funded launch."
              }
            </p>
            <StandardButton className="gradient-2 rounded-full md:text-[1.2vw]">
              {'Check It Out'}
            </StandardButton>
          </div>
        </div>
      </section>

      <section
        id="launchpad-features-section"
        className="relative px-[4vw] pt-[2vw] md:pt-[2vw] pb-[5vw] md:pb-[2vw] md:pb-[5vw] flex flex-col bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black"
      >
        <div className="flex flex-col pb-[5vw] md:pb-[2vw] items-center">
          <h2 className="mt-[5vw] md:mt-[2vw] font-GoodTimes text-[5vw] md:text-[2vw] text-center leading-[6vw]">
            {'Built for New Space Innovation'}
          </h2>
          <p className="md:max-w-[500px] lg:max-w-[900px] text-center md:text-[1.2vw] pb-[2vw]">
            {
              "Whether you're launching a nanosatellite, testing lunar ISRU tech, or sending humans to space, MoonDAO's Launch Pad provides the tools you need to turn your vision into reality while tapping into a global network of backers with funding that are passionate about space, as well as leading space companies and service providers that are already part of the Space Acceleration Network."
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
            title="Mission Crowdfunding"
            description="Secure funding from a global community that believes in space acceleration."
            icon="/assets/icon-crowdfunding.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#6C407D] to-[#5F4BA2]"
          />
          <FeatureIcon
            title="Builders & Innovators"
            description="From space robotics to lunar payloads, raise the capital you need to launch."
            icon="/assets/icon-lightbulb.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5F4BA2] to-[#5159CC]"
          />
          <FeatureIcon
            title="Fast Track Launch"
            description="Quick launch a token with set tokenomics and best practices to incentivize supporters."
            icon="/assets/icon-fasttrack.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5159CC] to-[#4660E7]"
          />
        </div>
      </section>

      <section
        id="moondao-success-section"
        className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-t from-[#010618] to-[#1B1C4B]"
      >
        <Image
          className="w-[50vw] hidden md:block absolute top-[-1px] right-0"
          src="/assets/launchpad/offwhite-divider-rl-inverted.svg"
          alt="Divider"
          width={500}
          height={500}
        />
        <div className="flex flex-col md:flex-row justify-between items-start">
          <div className="flex flex-col pt-[5vw] md:pt-[5vw] mr-[5vw] md:mr-0 ">
            <h2 className="text-[5vw] md:text-[2vw] font-GoodTimes">
              {'Success Stories'}
            </h2>
            <p className="md:text-[1.2vw] pb-[2vw] pr-0 md:pr-[5vw]">
              {
                "MoonDAO is no stranger to launching bold ideas. With over Ξ2,623 (+$8,000,000) crowdraised during our initial launch, we used those funds to send two people to space and support 60+ projects for over $300,000. We're proving that the future of space funding is decentralized and onchain."
              }
            </p>
            <StandardButton
              className="md:text-[1.2vw] gradient-2 rounded-full"
              onClick={handleCreateMission}
            >
              {'Launch Your Mission'}
            </StandardButton>
            <div
              id="coby-mobile-container"
              className="z-20 md:hidden flex justify-end relative h-auto mr-[-5vw] mt-[-5vw]"
            >
              <Image
                id="astronaut-coby-mobile"
                className="z-10 rounded-full h-full w-[40vw] top-0"
                src="/assets/astronaut-coby.png"
                alt="Astro"
                width={500}
                height={500}
              />
            </div>
            <div
              id="eiman-container"
              className="mt-[-20vw] md:mt-0 z-10 relative flex w-full max-w-[650px] h-full ml-auto"
            >
              <Image
                className="absolute bottom-0 right-0 z-10"
                src="/assets/launchpad/image-frame-3.svg"
                alt="Divider"
                width={900}
                height={900}
              />
              <Image
                className="relative rounded-full"
                src="/assets/eiman-jahangir.png"
                alt="Divider"
                width={900}
                height={900}
              />
            </div>
          </div>
          <div
            id="coby-desktop-container"
            className="hidden md:block relative min-w-[30vw] h-auto "
          >
            <div className="absolute top-0 right-0 z-20 min-w-[30vw] h-full">
              <Image
                id="image-frame-2"
                className="w-full h-full scale-[1.3]"
                src="/assets/launchpad/image-frame-2.svg"
                alt="Image Frame 2"
                width={315}
                height={315}
              />
            </div>
            <Image
              id="astronaut-coby-desktop"
              className="z-10 rounded-full h-full w-full top-0"
              src="/assets/astronaut-coby.png"
              alt="Astro"
              width={500}
              height={500}
            />
          </div>
        </div>
        <Image
          className="absolute w-[70vw] max-w-[1500px] bottom-[-2px] left-[-2px]"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="Divider"
          width={850}
          height={850}
        />
      </section>

      <section
        id="how-launchpad-works"
        className="relative px-[4vw] pb-24 flex flex-col items-center gap-12 bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black"
      >
        <div className="w-full mt-8 flex flex-col gap-2 items-center">
          <h1 className="mt-8 text-2xl font-GoodTimes">
            {'How Launchpad Works'}
          </h1>
        </div>

        <div className="w-full max-w-[800px]">
          <div className="absolute hidden md:block h-full max-h-[75%] md:left-1/2 md:transform md:-translate-x-1/2 top-32">
            <VerticalProgressScrollBar sectionId="how-launchpad-works" />
          </div>
          <div className="w-full flex flex-col items-end md:items-start gap-4">
            <FeatureIcon
              title="Create Your Team"
              description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
              icon={
                <p className="md:text-[1.2vw] pb-[2vw] font-GoodTimes text-white">
                  1
                </p>
              }
            />
            <div className="md:mt-[-10%] w-full flex justify-end">
              <FeatureIcon
                title="Create Your Team"
                description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
                icon={
                  <p className="md:text-[1.2vw] pb-[2vw] font-GoodTimes text-white">
                    2
                  </p>
                }
              />
            </div>
            <FeatureIcon
              title="Create Your Team"
              description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
              icon={
                <p className="md:text-[1.2vw] pb-[2vw] font-GoodTimes text-white">
                  3
                </p>
              }
            />
            <div className="md:mt-[-10%] w-full flex justify-end">
              <FeatureIcon
                title="Create Your Team"
                description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
                icon={
                  <p className="md:text-[1.2vw] pb-[2vw] font-GoodTimes text-white">
                    4
                  </p>
                }
              />
            </div>
          </div>
          <div className="mt-24 w-full flex items-center justify-center">
            <StandardButton
              className="gradient-2 rounded-full"
              hoverEffect={false}
            >
              {'Launch Your Mission'}
            </StandardButton>
          </div>
        </div>

        <Image
          className="absolute bottom-[-1px] left-0 -scale-x-100"
          src="/assets/launchpad/blue-divider-rl.svg"
          alt="Divider"
          width={250}
          height={250}
        />
      </section>

      <section id="benefits-section" className="relative">
        <div className="pt-[10vw] md:pt-0 pb-[5vw] md:pb-0 md:h-[max(30vh,300px)] lg:h-[max(50vh,700px)] justify-center relative flex flex-col items-center bg-gradient-to-b from-[#010618] to-[#1B1C4B]">
          <div className="w-full flex flex-col pt-[2vw] md:pt-[10vw] items-center">
            <h1 className="text-[5vw] md:text-[3vw] text-center pb-[5vw] md:pb-0 font-GoodTimes">
              {'Why use MoonDAO Launchpad?'}
            </h1>
          </div>
          {/* <Image
            className="absolute bottom-[-1px] left-0 -scale-x-100 w-[30vw] md:w-[20vw]"
            src="/assets/launchpad/blue-divider-rl.svg"
            alt="Divider"
            width={500}
            height={500}
          /> */}
          <div className="mt-[5vw] md:mt-[2vw] z-10 w-full md:w-[80%]">
            <CardStack>
              <LaunchpadBenefit
                title="Space is Global & Borderless"
                description="Space is Global & BorderlessTap into the power of a borderless, global crypto network with trillions of dollars in market cap that is available in seconds."
                icon="/assets/icon-globe.svg"
                align="left"
                slideDirection="right"
              />
              <LaunchpadBenefit
                title="Trustless & Transparent"
                description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
                icon="/assets/icon-signature.svg"
                align="right"
                slideDirection="left"
              />
              <LaunchpadBenefit
                title="Battle Tested"
                description="Powered by Juicebox, a proven platform for decentralized fundraising with over 1,000+ projects and over $200,000,000 raised."
                icon="/assets/icon-checkmark.svg"
                align="left"
                slideDirection="right"
              />
              <LaunchpadBenefit
                title="Scalable & Flexible"
                description="Adapt your fundraising strategy as your space mission evolves or utilize our quick launch guidelines and templates."
                icon="/assets/icon-scalable.svg"
                align="right"
                slideDirection="left"
              />
              <LaunchpadBenefit
                title="Power of the Network"
                description="The Space Acceleration Network brings industry leading space companies onchain, alongside space enthusiasts and professionals from around the globe."
                icon="/assets/icon-powerful.svg"
                align="left"
                slideDirection="right"
              />
            </CardStack>
          </div>
        </div>
        <Image
          className="absolute bottom-0 right-0 w-[40vw] md:w-[25vw]"
          src="/assets/launchpad/gradient-divider-rl.png"
          alt="Divider"
          width={300}
          height={300}
        />
      </section>

      <section
        id="final-callout-section"
        className="relative px-[5vw] py-[5vw] md:py-[2vw] flex flex-col start bg-gradient-to-bl from-[#6D3F79] to-[#435EEB] from-20% to-[80%]"
      >
        <div className="flex flex-col md:flex-row ">
          <Image
            src="/assets/MoonDAO-Logo-White.svg"
            alt="MoonDAO Logo"
            width={250}
            height={250}
            className="w-[30vw] md:w-[20vw]"
          />
          <div className="flex flex-col justify-center md:ml-[2vw]">
            <h3 className="text-white text-[5vw] md:text-[2vw] font-GoodTimes">
              {'Get Started Today'}
            </h3>
            <p className="text-white md:text-[1.2vw] pb-[2vw]">
              {
                'The next great space mission starts here. Join the decentralized space race and fund your mission with the MoonDAO Launch Pad. The Launch Pad is available permissionlessly to teams in the Space Acceleration Network.'
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
        className="bg-white text-black px-[5vw] w-full relative"
      >
        <Image 
          src="/assets/launchpad/gradient-blue-divider-lr-inverted.svg"
          alt="divider"
          width={75}
          height={75}
          className="z-[1] w-[30vw] absolute top-[-2px] left-[-2px]"
        />
        <div id="faq-content" className="z-[10] relative py-[5vw]">
          <div id="faq-title" className="flex flex-row items-center gap-[2vw] mb-[5vw] md:mb-[2vw]">
            <Image
              src="/assets/launchpad/question-mark.svg"
              alt="Question Mark"
              width={75}
              height={75}
              className="w-[20vw] md:w-[10vw]"
            />
            <h3 className="text-[5vw] md:text-[3vw] font-GoodTimes">
              {'Frequently Asked Questions'}
            </h3>            
          </div>  
          <FAQProvider defaultExpandedIndex={0}>
            <FAQ
              question="Who can use the Launchpad?"
              answer="Teams in the Space Acceleration Network can create Missions directly and permissionlessly, but anyone with a space-related project can apply to create their mission with the Launchpad—whether it's a research initiative, satellite deployment, lunar lander payload, or even a human spaceflight mission—in order to start raising funds. Apply now to tell us more about your objectives, fundraising goals, existing network, and how we can help."
            />
            <FAQ
              question="Why use blockchain for space crowdfunding?"
              answer="Blockchain ensures transparency, security, and trust in fundraising as well as being open to a global audience in a borderless nature. Every transaction is recorded onchain, meaning full visibility for backers as to how funds are used, and offers unique opportunities for backers to continue interacting with the project, including through governance decision making via tokens, ongoing stakeholding, or even revenue share opportunities in some cases, all through transparent and auditable computer code."
            />
            <FAQ
              question="Is this platform only for space startups?"
              answer="The Launchpad is primarily designed for space-related ventures, but any high-tech, hard-science, or deep-tech project aligned with MoonDAO's mission to help create or advance a lunar settlement could potentially launch a campaign."
            />
            <FAQ
              question="How much does it cost to launch a campaign?"
              answer="There is no upfront cost to create a Mission, but standard Ethereum network (gas) fees apply when deploying smart contracts. Additionally, MoonDAO/Juicebox receive a small percentage (10% in total) of successfully raised funds to sustain the platform and support other space related projects within the community governed treasury. Likewise, 10% of the tokens created for a Mission will be reserved for the MoonDAO treasury to align long term interests, with a 1-year cliff and three years streaming, meaning that tokens cannot be immediately sold. Furthermore, any outlays from the MoonDAO treasury require a vote."
            />
            <FAQ
              question="How does the cliff and streaming work?"
              answer="Funds raised through the MoonDAO Launch Pad are subject to a 1-year cliff, meaning they remain locked for the first year. After this period, they stream gradually over three years, ensuring sustainable, long-term funding. This applies to both the project's funds and MoonDAO's 10% reserve allocation, preventing immediate sell-offs and promoting ecosystem stability."
            />
            <FAQ
              question="Should I create an erc-20 token for my campaign?"
              answer="It depends on your project's goals. An ERC-20 token can provide liquidity, community ownership, and governance features, but it also introduces risks like speculation and regulatory concerns. Tokens allow for tradability on decentralized exchanges, enabling supporters to buy, sell, or hold them as part of the project's ecosystem. They can also incentivize engagement through governance rights or utility within the project. However, speculative trading can create volatility, potentially impacting long-term sustainability."
            />
            <FAQ
              question="Do I need to manage liquidity for my token?"
              answer="If you launch an ERC-20 token through the MoonDAO Launchpad, an initial liquidity pool will automatically be created. This pool sets aside an additional 10% of both the token and ETH reserves, ensuring some market liquidity. This means that up to 80% of the total raised funds can be utilized by the Mission, after the 10% allocated to MoonDAO's treasury as a fee and the 10% liquidity."
            />
            <FAQ
              question="Can I fundraise in multiple cryptocurrencies?"
              answer="Fundraising will be limited to the Ethereum Virtual Machine (EVM), but contributors can participate across Ethereum mainnet and Layer 2 networks, including Arbitrum, Base, and Polygon. This ensures broad accessibility while keeping transactions efficient and cost-effective while also tying into the existing Space Acceleration Network and MoonDAO infrastructure, and the wider EVM ecosystem."
            />
            <FAQ
              question="Can contributors withdraw their funds if they change their minds?"
              answer="By default, once funds are contributed, they belong to the campaign. However, creators can implement refund mechanisms if they choose such as if they fail to meet the fundraising goal. Additionally, some projects may opt for a revenue-sharing model (RevNet), where tokens represent a percentage of total funds and can be redeemed for the underlying ETH—particularly appealing for Missions or initiatives that could potentially generate a profit in the future or generate onchain revenue."
            />
            <FAQ
              question="What are the tax and regulatory implications of fundraising with crypto?"
              answer="Tax and regulatory requirements vary by jurisdiction, and funds raised through the Launchpad may be considered taxable income. Depending on local laws, you may need to report contributions, pay capital gains tax on held crypto, or comply with securities regulations if your token is classified as an investment. Some regions also require KYC/AML compliance for fundraising. Since regulations are constantly evolving, we strongly recommend consulting a crypto-savvy legal or tax professional to ensure compliance. MoonDAO does not provide legal or tax advice, and responsibility for compliance rests with campaign creators."
            />
          </FAQProvider>
        </div>  
      </section>
    </>
  )
}

export const getStaticProps: GetStaticProps = async () => {
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
