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
  const shallowQueryRoute = useShallowQueryRoute()

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

  useEffect(() => {
    if (status === 'create') {
      shallowQueryRoute({ create: true })
    } else {
      shallowQueryRoute({})
    }
  }, [status])

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
    <section>
      {/* Video Section */}
      <div className="relative w-full h-auto flex justify-between">
        <div className="w-[20vw] h-6" />
        <div className="hidden md:block absolute left-0 top-0 h-full max-w-[500px] w-[100%] z-[10] bg-gradient-to-r from-[#080C20] from-35% via-[#080C20] to-transparent" />
        <Image
          className="w-full"
          src="/assets/launchpad/launchpad-video.png"
          alt="Launch Background"
          width={1000}
          height={1000}
        />
        <Image
          className="absolute right-0 bottom-[-1px] z-[10]"
          src="/assets/launchpad/blue-divider-rl.svg"
          alt="Divider"
          width={250}
          height={250}
        />
        <div className="absolute top-1/4 left-[10%] flex z-[10]">
          <Image
            className="w-[25vw] h-[25vw] md:w-full md:h-full"
            src="/assets/moondao-logo.svg"
            alt="Logo"
            width={250}
            height={250}
          />
          <div className="mt-12 ml-8 h-full flex flex-col gap-2">
            <h1 className="text-white text-[3vw] xl:text-[300%] font-GoodTimes">
              {'MoonDAO'}
              <br />
              {'Launchpad'}
            </h1>
            <div className="mt-4 flex gap-4 items-center">
              <Image
                className="w-[4vw] h-[4vw]"
                src="/assets/launchpad/token.svg"
                alt="Org"
                width={45}
                height={45}
              />
              <p className="text-white text-[2vw] 2xl:text-lg font-GoodTimes">
                {'Raise Funds'}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Featured Section */}
      <div className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-b from-[#010618] to-[#1B1C4B]">
        <div className="mt-4 flex flex-col md:flex-row justify-center gap-4 md:gap-12 md:items-center">
          <p className="text-white md:text-lg font-GoodTimes">
            {'Launch Your Space Mission With MoonDAO'}
          </p>
          <StandardButton
            className="gradient-2 rounded-full"
            hoverEffect={false}
            onClick={handleCreateMission}
          >
            {'Launch Your Mission'}
          </StandardButton>
        </div>

        <Image
          className="hidden md:block absolute bottom-[-1px] left-0"
          src="/assets/launchpad/white-divider-lr.svg"
          alt="Image Frame 1"
          width={500}
          height={500}
        />

        <div className="relative flex flex-col md:flex-row gap-12 md:items-center">
          <div className="relative">
            <Image
              className="absolute top-0 -left-1 z-20 scale-[1.075]"
              src="/assets/launchpad/image-frame-1.svg"
              alt="Image Frame 1"
              width={315}
              height={315}
            />
            <Image
              className="z-10"
              src="/assets/launchpad/space-mice.png"
              alt="Astro"
              width={300}
              height={300}
            />
          </div>
          <div className="w-full h-auto flex flex-col gap-2 max-w-[500px]">
            <p className="text-white text-lg font-GoodTimes">
              {'Save the Space Mice!'}
            </p>
            <p>
              {
                'Join the first onchain fundraising platform designed exclusively for space missions. MoonDAO’s Launch Pad empowers teams to raise funds transparently, manage their treasuries independently, and take their space exploration ideas from concept to fully funded launch.'
              }
            </p>
            <StandardButton className="gradient-2 rounded-full">
              {'Check It Out'}
            </StandardButton>
          </div>
        </div>
      </div>

      {/* Launch Pad CTA Section */}
      <div className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-r from-[#FFFFFF] to-[#F1F1F1] text-black">
        <div className="flex flex-col gap-2">
          <h1 className="mt-8 text-2xl font-GoodTimes">
            {'Built for New Space Innovation'}
          </h1>
          <p className="max-w-[500px]">
            {
              "Whether you're launching a nanosatellite, testing lunar ISRU tech, or sending humans to space, MoonDAO’s Launch Pad provides the tools you need to turn your vision into reality while tapping into a global network of backers with funding that are passionate about space, as well as leading space companies and service providers that are already part of the Space Acceleration Network."
            }
          </p>
          <StandardButton
            className="gradient-2 rounded-full"
            onClick={handleCreateMission}
          >
            {'Launch Your Mission'}
          </StandardButton>
        </div>

        <div className="w-full flex flex-col md:flex-row items-center md:items-start">
          <FeatureIcon
            title="Mission Crowdfunding"
            description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
            icon="/assets/launchpad/funding.svg"
          />
          <FeatureIcon
            title="Builders & Innovators"
            description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
            icon="/assets/launchpad/lightbulb.svg"
          />
          <FeatureIcon
            title="Fast Track Launch"
            description="Secure funding from a global community that belives in space acceleration."
            icon="/assets/launchpad/rocket.svg"
          />
        </div>
      </div>

      {/* Success Stories Section */}
      <div className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-t from-[#010618] to-[#1B1C4B]">
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
              {
                'MoonDAO is no stranger to launching bold ideas. With over Ξ2,623 (+$8,000,000) crowdraised during our initial launch, we used those funds to send two people to space and support 60+ projects for over $300,000. We’re proving that the future of space funding is decentralized and onchain.'
              }
            </p>
            <StandardButton
              className="gradient-2 rounded-full"
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
      </div>

      {/* How Launchpad Works Section */}
      <div
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
      </div>

      {/* Launchpad Benefits */}
      <div>
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
              description="Space is Global & Borderless Tap into the power of a borderless, global crypto network with trillions of dollars in market cap that is available in seconds."
              icon="/assets/launchpad/globe.svg"
              align="left"
            />
          </div>
        </div>

        <div className="relative p-[4vw] py-[8vw] flex flex-col items-center gap-12 bg-gradient-to-b from-[#010618] to-[#0C0F28]">
          <div className="z-10">
            <LaunchpadBenefit
              title="Trustless & Transparent"
              description="All transactions are transparent and onchain, ensuring that everyone can see the funds raised and used."
              icon="/assets/launchpad/sign.svg"
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
              icon="/assets/launchpad/checkmark.svg"
              align="left"
            />
            <LaunchpadBenefit
              title="Scalable & Flexible"
              description="Adapt your fundraising strategy as your space mission evolves or utilize our quick launch guidelines and templates."
              icon="/assets/launchpad/scalable.svg"
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
              icon="/assets/launchpad/power.svg"
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
      </div>

      {/* Get Started Section */}
      <div className="relative p-[8vw] flex flex-col start gap-12 bg-gradient-to-bl from-[#6D3F79] to-[#435EEB] from-20%">
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
              {
                'The next great space mission starts here. Join the decentralized space race and fund your mission with the MoonDAO Launch Pad. The Launch Pad is available permissionlessly to teams in the Space Acceleration Network.'
              }
            </p>
            <StandardButton
              className="bg-[#FFFFFF] rounded-full"
              textColor="text-black"
              onClick={handleCreateMission}
            >
              {'Launch Your Mission'}
            </StandardButton>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-b from-[#FFFFFF] to-[#F1F1F1] text-black">
        <Image
          className="absolute top-0 left-0"
          src="/assets/launchpad/gradient-blue-divider-lr-inverted.svg"
          alt="Divider"
          width={250}
          height={250}
        />

        <div className="mt-12 ml-4 md:ml-0 md:mt-8 md:pl-[4vw] xl:pl-0 w-full flex gap-6 items-center z-10">
          <Image
            className=""
            src="/assets/launchpad/question-mark.svg"
            alt="Divider"
            width={75}
            height={75}
          />
          <h1 className="text-2xl font-GoodTimes">
            {'Frequently Asked Questions'}
          </h1>
        </div>
        <div className="ml-4 md:ml-4 md:mt-8 md:pl-[4vw] xl:pl-0 w-full">
          <FAQ
            question="What is MoonDAO?"
            answer="MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators. MoonDAO is a decentralized autonomous organization that is building a network of space explorers and innovators."
          />
        </div>
      </div>
    </section>
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
