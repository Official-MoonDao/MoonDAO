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
import FAQ from '@/components/launchpad/FAQ'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import LaunchpadBenefit from '@/components/launchpad/LaunchpadBenefit'
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
      <section id="hero-section">
        <div id="hero-content-container" className="">
          <div id="hero-content" className="relative md:h-[max(40vh,400px)] lg:h-[max(80vh,650px)] flex justify-between items-center">
            <div className="relative">
              <video id="video-background" className="min-w-[100vw] md:w-full object-cover md:h-[max(40vh,400px)] lg:h-[max(80vh,650px)] object-right" autoPlay loop muted playsInline >
                <source src="/assets/moondao-video-hero.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#010618] to-transparent opacity-80"></div>
            </div>
            <div id="content-container" className="flex items-center overflow-hidden">
              <Image id="hero-divider-bottom-right"
                className="absolute right-[-2px] bottom-[-2px] z-[10] w-[50vw] md:w-[30vw]"
                src="/assets/launchpad/blue-divider-rl.svg"
                alt="Divider"
                width={250}
                height={250}
              />
              <div id="logo-and-graphics-container" className="absolute w-full h-full md:h-auto left-[0] md:pl-[2vw] justify-end flex-col md:flex-row flex items-center md:justify-start z-[10]">
                <div id="logo-container">
                  <Image id="desktop-logo"
                    className="hidden md:flex w-[30vw] h-[30vw] md:w-auto"
                    src="/assets/MoonDAO Animated Logo - Original.svg"
                    alt="Logo"
                    width={250}
                    height={250}
                  />
                  <Image id="mobile-logo"
                    className="md:hidden w-[30vw] h-[30vw] md:w-auto"
                    src="/assets/MoonDAO Animated Logo - White.svg"
                    alt="Logo"
                    width={250}
                    height={250}
                  />
                </div>                  
                <div id="graphics-container" className="md:h-full flex flex-col items-center md:items-left justify-center pb-[5vw] md:pb-0">
                  <div id="desktop-title-container" className="hidden md:flex">
                    <Image id="desktop-title"
                      src="/assets/MoonDAOLaunchpad.svg"
                      alt="MoonDAO Launchpad"
                      width={500}
                      height={150}
                      className="w-[40vw]"
                    />
                  </div>
                  <div id="mobile-title-container" className="md:hidden">
                    <Image id="mobile-title"
                      src="/assets/MoonDAOLaunchpadCentered.svg"
                      alt="MoonDAO Launchpad"
                      width={500}
                      height={150}
                      className="w-[40vw]"
                    />                
                  </div>  
                  <div id="desktop-tagline-container" className="hidden w-full md:flex justify-center items-center">
                    <Image id="desktop-tagline"
                      className="w-[90vw] h-[17vw] md:w-[40vw] md:h-[6.86vw]"
                      src="/assets/Animated-Icon-Tagline.svg"
                      alt="Org"
                      width={450}
                      height={450}
                    />
                  </div>
                  <div id="mobile-tagline-container" className="ml-[5vw] w-full md:hidden justify-center items-center">
                    <Image id="mobile-tagline"
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

      <section id="initial-callout-section" className="px-[5vw] md:px-[2vw] flex flex-col md:flex-row items-center justify-center pt-[10vw] md:pt-[2vw] pb-[10vw] md:pb-[2vw] gap-4 md:gap-12 bg-gradient-to-b md:bg-gradient-to-l from-[#010618] from-[0%] md:from-[40%] to-[#1B1C4B] to-[100%] md:to-[60%]">
        <p id="callout" className="text-white text-lg font-GoodTimes text-[5vw] md:text-[2vw] text-center leading-[6vw]">
          {'Launch Your Space Mission With MoonDAO'}
        </p>
        <StandardButton className="gradient-2 rounded-full md:text-[1.2vw]" hoverEffect={false} onClick={handleCreateMission} >
          {'Launch Your Mission'}
        </StandardButton>
      </section>
      
      <section id="featured-project-section" className="relative px-[5vw] pb-[5vw] overflow-hidden flex flex-col gap-12 bg-gradient-to-b from-[#010618] to-[#1B1C4B]">
        <Image id="white-divider-bottom-right" className="absolute bottom-[-2px] right-[-2px] -scale-x-100 w-[20vw]"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="divider"
          width={500}
          height={500}
        />
        <Image id="blue-divider-top-left" className="absolute top-[-2px] left-[-2px] w-[90vw] md:w-[40vw]"
          src="/assets/launchpad/divider-13.svg"
          alt="divider"
          width={500}
          height={500}
        />        
        <div id="featured-image-container" className="pb-[5vw] md:pb-0 pt-[5vw] md:pt-0 relative flex flex-col items-center md:flex-row gap-12">
          <div id="featured-image-container" className="md:ml-0 relative w-[80vw] md:w-[max(50vw,500px)]">
              <Image id="featured-image-frame" className="absolute top-0 right-0 z-20 w-full h-full"
                src="/assets/launchpad/image-frame-1.svg"
                alt="Image Frame 1"
                width={315}
                height={315}
              />
              <Image id="featured-image" className="z-10 w-full h-full"
                src="/assets/launchpad/space-mice.png"
                alt="Astro"
                width={300}
                height={300}
              />
          </div>          
          <div id="featured-text-container" className="w-full h-auto flex justify-center flex-col  lg:max-w-[900px]">
              <h2 className="text-white font-GoodTimes text-[5vw] md:text-[2vw] md:pb-[1vw]">
                {'Save the Space Mice!'}
              </h2>
              <p className="md:text-[1.2vw] pb-[2vw]">
                {"Join the first onchain fundraising platform designed exclusively for space missions. MoonDAO's Launch Pad empowers teams to raise funds transparently, manage their treasuries independently, and take their space exploration ideas from concept to fully funded launch."}
              </p>
              <StandardButton className="gradient-2 rounded-full md:text-[1.2vw]">
                {'Check It Out'}
              </StandardButton>
          </div>          
        </div>
      </section>
      
      <section id="launchpad-features-section" className="relative px-[4vw] md:pb-[5vw] flex flex-col gap-12 bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black">
        <div className="flex flex-col gap-2 items-center">
          <h2 className="mt-[5vw] md:mt-[2vw] font-GoodTimes text-[5vw] md:text-[2vw] text-center leading-[6vw]">
            {'Built for New Space Innovation'}
          </h2>
          <p className="md:max-w-[500px] lg:max-w-[900px] text-center md:text-[1.2vw] pb-[2vw]">
            {"Whether you're launching a nanosatellite, testing lunar ISRU tech, or sending humans to space, MoonDAO's Launch Pad provides the tools you need to turn your vision into reality while tapping into a global network of backers with funding that are passionate about space, as well as leading space companies and service providers that are already part of the Space Acceleration Network."}
          </p>
          <StandardButton className="md:text-[1.2vw] gradient-2 rounded-full" onClick={handleCreateMission} >
            {'Launch Your Mission'}
          </StandardButton>
        </div>
        <div className="w-full flex flex-col md:flex-row items-start justify-between">
          <FeatureIcon 
            title="Mission Crowdfunding"
            description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
            icon="/assets/icon-crowdfunding.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#6C407D] to-[#5F4BA2]"
          />
          <FeatureIcon
            title="Builders & Innovators"
            description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
            icon="/assets/icon-lightbulb.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5F4BA2] to-[#5159CC]"
          />
          <FeatureIcon
            title="Fast Track Launch"
            description="Secure funding from a global community that belives in space acceleration."
            icon="/assets/icon-fasttrack.svg"
            gradient="bg-gradient-to-b md:bg-gradient-to-r from-[#5159CC] to-[#4660E7]"
          />
        </div>
      </section>

      <section id="moondao-success-section" className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-t from-[#010618] to-[#1B1C4B]">
        <Image
          className="hidden md:block absolute top-[-1px] right-0"
          src="/assets/launchpad/offwhite-divider-rl-inverted.svg"
          alt="Divider"
          width={500}
          height={500}
        />
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-col gap-2">
            <h1 className="mt-24 text-2xl font-GoodTimes">
              {'Success Stories'}
            </h1>
            <p className="max-w-[500px]">
              {"MoonDAO is no stranger to launching bold ideas. With over Ξ2,623 (+$8,000,000) crowdraised during our initial launch, we used those funds to send two people to space and support 60+ projects for over $300,000. We're proving that the future of space funding is decentralized and onchain."}
            </p>
            <StandardButton className="md:text-[1.2vw] gradient-2 rounded-full"
              onClick={handleCreateMission}
              >
              {'Launch Your Mission'}
            </StandardButton>
          </div>
          <div className="mt-12 md:mt-0 relative w-full h-full max-w-[300px] max-h-[300px]">
            <Image
              className="absolute top-0 left-0 z-20 h-full w-full scale-[1.65]"
              src="/assets/launchpad/image-frame-2.svg"
              alt="Image Frame 2"
              width={315}
              height={315}
            />
            <Image
              className="z-10 rounded-full w-full h-full max-w-[300px] max-h-[300px]"
              src="/assets/astronaut-coby.png"
              alt="Astro"
              width={300}
              height={300}
            />
          </div>
        </div>
        <Image
          className="absolute bottom-[-1px] left-0"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="Divider"
          width={850}
          height={850}
        />
        <div className="relative w-full h-full">
          <Image
            className="absolute bottom-0 left-0 z-10"
            src="/assets/launchpad/image-frame-3.svg"
            alt="Divider"
            width={505}
            height={500}
          />
          <Image
            className="relative left-[4px] bottom-[4px] rounded-full"
            src="/assets/eiman-jahangir.png"
            alt="Divider"
            width={500}
            height={500}
          />
        </div>
      </section>

      <section id="how-launchpad-works" className="relative px-[4vw] pb-24 flex flex-col items-center gap-12 bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black" >
        <div className="w-full mt-8 flex flex-col gap-2 items-center">
          <h1 className="mt-8 text-2xl font-GoodTimes">
            {'How Launchpad Works'}
          </h1>
        </div>

        <div className="w-full max-w-[800px]">
          <div className="absolute hidden md:block h-full max-h-[75%] md:left-1/2 md:transform md:-translate-x-1/2 top-32">
            <VerticalProgressScrollBar sectionId="how-launchpad-works" />
          </div>

          <div className="absolute md:hidden h-full max-h-[75%] left-2 min-[450px]:left-[5vw] top-32">
            <VerticalProgressScrollBar sectionId="how-launchpad-works" />
          </div>

          <div className="w-full flex flex-col items-end md:items-start gap-4">
            <FeatureIcon
              title="Create Your Team"
              description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
              icon={<p className="text-4xl font-GoodTimes text-white">1</p>}
            />
            <div className="md:mt-[-10%] w-full flex justify-end">
              <FeatureIcon
                title="Create Your Team"
                description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
                icon={<p className="text-4xl font-GoodTimes text-white">2</p>}
              />
            </div>
            <FeatureIcon
              className="md:mt-[-10%]"
              title="Create Your Team"
              description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
              icon={<p className="text-4xl font-GoodTimes text-white">3</p>}
            />
            <div className="md:mt-[-10%] w-full flex justify-end">
              <FeatureIcon
                title="Create Your Team"
                description="Bring your organization onchain into the Space Acceleration Network to create a secure multi-sig wallet and the tools needed for fundraising, alongside a hiring portal and marketplace access to directly sell your products or services onchain."
                icon={<p className="text-4xl font-GoodTimes text-white">4</p>}
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

      <section id="benefits-section">
        <div className="relative p-[4vw] py-[6vw] flex flex-col items-center gap-12 bg-gradient-to-b from-[#010618] to-[#1B1C4B]">
          <div className="w-full flex flex-col gap-2 items-center">
            <h1 className="text-2xl font-GoodTimes">
              {'Why use MoonDAO Launchpad?'}
            </h1>
          </div>
          <Image
            className="absolute bottom-[-1px] left-0 -scale-x-100"
            src="/assets/launchpad/blue-divider-rl.svg"
            alt="Divider"
            width={500}
            height={500}
          />
          <div className="mt-8 z-10">
            <LaunchpadBenefit
              title="Space is Global & Borderless"
              description="Space is Global & BorderlessTap into the power of a borderless, global crypto network with trillions of dollars in market cap that is available in seconds."
              icon="/assets/icon-globe.svg"
              align="left"
            />
          </div>
        </div>
        <div className="relative p-[4vw] py-[8vw] flex flex-col items-center gap-12 bg-gradient-to-b from-[#010618] to-[#0C0F28]">
          <div className="z-10">
            <LaunchpadBenefit
              title="Trustless & Transparent"
              description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
              icon="/assets/icon-signature.svg"
              align="right"
            />
          </div>
        </div>
        <div className="relative p-[4vw] flex flex-col items-center gap-12 bg-gradient-to-t from-[#010618] to-[#1B1C4B]">
          <Image
            className="absolute top-0 left-[-30px]"
            src="/assets/launchpad/blue-divider-lr-inverted.svg"
            alt="Divider"
            width={500}
            height={500}
          />
          <div className="z-10 flex flex-col gap-24">
            <LaunchpadBenefit
              title="Battle Tested"
              description="Powered by Juicebox, a proven platform for decentralized fundraising with over 1,000+ projects and over $200,000,000 raised."
              icon="/assets/icon-checkmark.svg"
              align="left"
              gradient="gradient-2"
            />
            <LaunchpadBenefit
              title="Scalable & Flexible"
              description="Adapt your fundraising strategy as your space mission evolves or utilize our quick launch guidelines and templates."
              icon="/assets/icon-scalable.svg"
              align="right"
            />
          </div>
          <Image
            className="absolute bottom-0 right-0"
            src="/assets/launchpad/blue-divider-rl.svg"
            alt="Divider"
            width={500}
            height={500}
          />
        </div>
        <div className="relative p-[8vw] pb-48 flex flex-col items-center gap-12 bg-gradient-to-b from-[#010618] to-[#0C0F28]">
          <div className="z-10">
            <LaunchpadBenefit
              title="Power of the Network"
              description="The Space Acceleration Network brings industry leading space companies onchain, alongside space enthusiasts and professionals from around the globe."
              icon="/assets/icon-powerful.svg"
              align="left"
            />
          </div>
          <Image
            className="absolute bottom-0 right-0"
            src="/assets/launchpad/gradient-divider-rl.png"
            alt="Divider"
            width={300}
            height={300}
          />
        </div>
      </section>

      <section id="final-callout-section" className="relative p-[8vw] flex flex-col start gap-12 bg-gradient-to-bl from-[#6D3F79] to-[#435EEB] from-20%">
        <div className="flex flex-col md:flex-row gap-4">
          <Image
            src="/assets/MoonDAO-Logo-White.svg"
            alt="Divider"
            width={250}
            height={250}
          />
          <div className="mt-[5%] flex flex-col gap-2">
            <h3 className="text-white text-2xl font-GoodTimes">
              {'Get Started Today'}
            </h3>
            <p className="text-white text-sm">
              {'The next great space mission starts here. Join the decentralized space race and fund your mission with the MoonDAO Launch Pad. The Launch Pad is available permissionlessly to teams in the Space Acceleration Network.'}
            </p>
            <StandardButton className="md:text-[1.2vw] bg-[#FFFFFF] rounded-full"
              textColor="text-black"
              onClick={handleCreateMission}
              >
              {'Launch Your Mission'}
            </StandardButton>
          </div>
        </div>
      </section>

      <section id="faq-section-header" className="mt-12 ml-4 md:ml-0 md:mt-8 md:pl-[4vw] xl:pl-0 w-full flex gap-6 items-center z-10">
        <Image
          src="/assets/launchpad/question-mark.svg"
          alt="Divider"
          width={75}
          height={75}
        />
        <h1 className="text-2xl font-GoodTimes">
          {'Frequently Asked Questions'}
        </h1>
      </section>

      <section id="faq-section-content" className="ml-4 md:ml-4 md:mt-8 md:pl-[4vw] xl:pl-0 w-full">
        <FAQ
          question="What is MoonDAO?"
          answer="MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators."
        />
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
