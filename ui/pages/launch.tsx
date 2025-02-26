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
import Container from '../components/layout/Container'
import FeatureIcon from '@/components/launchpad/FeatureIcon'
import ContentLayout from '@/components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import CreateMission from '@/components/mission/CreateMission'
import MissionCard from '@/components/mission/MissionCard'

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
    <section className="overflow-auto">
      {/* Video Section */}
      <div className="relative w-full h-auto flex justify-between">
        <div className="w-[20vw] h-6" />
        <div className="hidden md:block absolute left-0 top-0 h-full max-w-[500px] w-[100%] z-[10] bg-gradient-to-r from-[#080C20] from-35% via-[#080C20] to-transparent" />
        <Image
          className="w-full"
          src="/assets/launchpad-video.png"
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
            <h1 className="text-white text-[3vw] font-GoodTimes">
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
              <p className="text-white text-[2vw] font-GoodTimes">
                {'Raise Funds'}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Featured Section */}
      <div className="relative px-[4vw] pb-[4vw] flex flex-col gap-12 bg-gradient-to-b from-[#010618] to-[#1B1C4B]">
        <div className="mt-4 flex flex-col md:flex-row justify-center gap-4 md:gap-12 md:items-center">
          <p className="text-white text-lg font-GoodTimes">
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

        <div className="relative flex flex-col md:flex-row gap-12">
          <Image
            className="absolute top-0 left-0 z-20"
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
          <StandardButton className="gradient-2 rounded-full">
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
          className="hidden md:block absolute top-[-0.7px] right-0"
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
            <StandardButton className="gradient-2 rounded-full">
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
      </div>
      {/* <div className="w-full md:w-[90%] flex flex-col items-center justify-center">
        <SectionCard>
          <div className="p-10 flex flex-col md:flex-row gap-4">
            <div className="w-[200px] h-[200px] bg-white rounded-full" />
            <div className="w-3/4 flex flex-col gap-4">
              <h2 className="header font-GoodTimes">Launch Pad</h2>
              <p className="text-lg">
                Join the first onchain fundraising platform designed exclusively
                for space missions. MoonDAO's Launch Pad empowers teams to raise
                funds transparently, manage their treasuries independently, and
                take their space exploration ideas from
              </p>
              <StandardButton
                className="gradient-2 rounded-full"
                hoverEffect={false}
                onClick={handleCreateMission}
              >
                Launch Your Mission
              </StandardButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          header="Explore Missions"
          iconSrc="/assets/icon-org.svg"
          action={
            <StandardButton
              className="gradient-2 rounded-full"
              hoverEffect={false}
              link="/missions"
            >
              See More
            </StandardButton>
          }
        >
          <SlidingCardMenu>
            {missions && missions.length > 0 ? (
              missions.map((mission: any) => (
                <MissionCard
                  key={`mission-card-${mission.id}`}
                  mission={mission}
                  teamContract={teamContract}
                  jbControllerContract={jbControllerContract}
                  jbTokensContract={jbTokensContract}
                  compact
                />
              ))
            ) : (
              <p>No missions found</p>
            )}
          </SlidingCardMenu>
        </SectionCard>

        <SectionCard header="Features Title" iconSrc="/assets/icon-org.svg">
          <div className="flex flex-col md:flex-row gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`feature-${index}`}
                className="p-2 md:w-1/3 flex flex-col gap-4 bg-white text-black"
              >
                <div className="flex gap-4 items-center">
                  <div className="w-[50px] h-[50px] bg-black rounded-full" />
                  <h3 className="font-GoodTimes">Feature Title</h3>
                </div>
                <p className="border-2 border-black p-2 min-h-[100px]">
                  Callout Paragraph
                </p>
              </div>
            ))}
          </div>
          <StandardButton
            className="mt-4 gradient-2 rounded-full"
            hoverEffect={false}
            onClick={handleCreateMission}
          >
            Launch Your Mission
          </StandardButton>
        </SectionCard>

        <SectionCard className="relative min-h-[800px]">
          <Image
            className="absolute top-0 right-0"
            src="/assets/launchpad-astro.png"
            alt="Launchpad Astro"
            width={500}
            height={500}
          />
          <div className="p-10 flex flex-col md:flex-row gap-4">
            <div className="w-[200px] h-[200px] bg-white rounded-full" />
            <div className="w-3/4 flex flex-col gap-4">
              <h2 className="header font-GoodTimes">Success Stories</h2>
              <p className="text-lg">
                MoonDAO is no stranger to launching bold ideas. With over Ξ2,623
                (+$8,000,000) crowdraised during our initial launch, we used
                those funds to send two people to space and support 60+ projects
                for over $300,000. We're proving that the future of space
                funding is decentralized and onchain.
              </p>
            </div>
          </div>
          <h2 className="text-4xl font-GoodTimes">How the launchpad works</h2>
          <div className="mt-12 flex flex-col gap-8">
            {[
              {
                title: 'step 1',
                description: 'step 1 description',
              },
              { title: 'step 2', description: 'step 2 description' },
              { title: 'step 3', description: 'step 3 description' },
            ].map((step: any, i: number) => (
              <div
                key={`step-${step.title}`}
                className="flex gap-4 items-center h-[100px]"
              >
                <div className="w-[50px] h-[50px] bg-white rounded-full text-black flex items-center justify-center text-2xl font-bold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-2xl font-GoodTimes">{step.title}</h3>
                  <p className="text-lg">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard header="Why Use the Launchpad?">
          <div></div>
        </SectionCard>

        <SectionCard header="FAQ">
          <div></div>
        </SectionCard>

        <SectionCard header="Get Started Today">
          <div></div>
        </SectionCard>
      </div> */}
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
