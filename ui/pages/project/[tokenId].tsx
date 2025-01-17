import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import ProjectABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  CITIZEN_ADDRESSES,
  HATS_ADDRESS,
  MOONEY_ADDRESSES,
  PROJECT_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { blockedProjects } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamTreasury from '@/components/subscription/TeamTreasury'

type ProjectProfileProps = {
  tokenId: string
  project: Project
}

export default function ProjectProfile({
  tokenId,
  project,
}: ProjectProfileProps) {
  const sdk = useSDK()
  const address = useAddress()

  const { selectedChain } = useContext(ChainContext)

  //Contracts
  const { contract: hatsContract } = useContract(HATS_ADDRESS)
  const { contract: projectContract } = useContract(
    PROJECT_ADDRESSES[selectedChain.slug],
    ProjectABI
  )
  const { contract: citizenConract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )

  const [owner, setOwner] = useState('')

  useEffect(() => {
    async function getOwner() {
      const owner = await projectContract?.call('ownerOf', [tokenId])
      setOwner(owner)
    }
    if (projectContract) getOwner()
  }, [tokenId, projectContract])

  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, owner)

  const {
    adminHatId,
    managerHatId,
    isManager,
    isActive,
    nanceProposal,
    proposalJSON,
    totalBudget,
    MDP,
    isLoading: isLoadingProjectData,
  } = useProjectData(projectContract, hatsContract, project)
  //Hats
  const hats = useSubHats(selectedChain, adminHatId)

  const [nativeBalance, setNativeBalance] = useState<number>(0)

  // get native balance for multisigj
  useEffect(() => {
    async function getNativeBalance() {
      const provider = sdk?.getProvider()
      const balance: any = await provider?.getBalance(owner as string)
      setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
    }

    if (sdk && owner) {
      getNativeBalance()
    }
  }, [sdk, project])

  useChainDefault()

  //Profile Header Section
  const ProfileHeader = (
    <div id="orgheader-container">
      <Frame
        noPadding
        bottomRight="0px"
        bottomLeft="0px"
        topLeft="0px"
        topRight="0px"
        className="z-50"
        marginBottom="0px"
      >
        <div id="frame-content-container" className="w-full">
          <div
            id="frame-content"
            className="w-full flex flex-col items-start justify-between"
          >
            <div
              id="profile-description-section"
              className="flex flex-col lg:flex-row items-start lg:items-center gap-4"
            >
              <div id="team-name-container">
                <div id="profile-container">
                  {project?.description ? (
                    <p
                      id="profile-description-container"
                      className="mb-5 w-full lg:w-[80%]"
                    >
                      {project.description || ''}
                    </p>
                  ) : (
                    <></>
                  )}
                </div>
              </div>
            </div>
            <div
              id="project-stats-container"
              className="flex items-center gap-2 "
            >
              <p>{`Awarded: ${totalBudget} ETH`}</p>
              <Image src={'/coins/ETH.svg'} width={15} height={15} alt="ETH" />
            </div>
          </div>
        </div>
      </Frame>
    </div>
  )

  return (
    <Container>
      <Head title={project.name} description={project.description} />
      <ContentLayout
        header={project.name}
        headerSize="max(20px, 3vw)"
        description={ProfileHeader}
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
        preFooter={<NoticeFooter darkBackground={true} />}
      >
        <div
          id="page-container"
          className="animate-fadeIn flex flex-col gap-5 w-full max-w-[1080px]"
        >
          {/* Project Overview */}
          <Frame
            noPadding
            bottomLeft="0px"
            bottomRight="0px"
            topRight="0px"
            topLeft="0px"
          >
            <div
              id="project-overview-container"
              className="w-full md:rounded-tl-[2vmax] md:p-5 md:pr-0 md:pb-14 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section"
            >
              <div className="p-5 pb-0 md:p-0 flex flex-col items-start gap-5 pr-12 ">
                {/* Enable when final report editor is ready */}
                {/* <Link href={'/submit?tab=report'} passHref>
                  <StandardButton className="mt-4 md:mt-0 gradient-2 rounded-full">
                    <div className="flex items-center gap-2">
                      <Image
                        src={'/assets/plus-icon.png'}
                        width={20}
                        height={20}
                        alt="Attach Final Report"
                      />
                      {'Attach Final Report'}
                    </div>
                  </StandardButton>
                </Link> */}

                <div className="flex gap-4 opacity-[50%]">
                  <Image
                    src={'/assets/icon-star.svg'}
                    alt="Star Icon"
                    width={30}
                    height={30}
                  />
                  <h2 className="header font-GoodTimes">Project Overview</h2>
                </div>
              </div>

              <p className="py-4 px-4 md:px-0 opacity-60">
                {proposalJSON?.abstract}
              </p>

              <div className="flex items-center gap-2 px-4 md:px-0">
                <Link className="flex gap-2" href={`/proposal/${MDP}`} passHref>
                  <Image
                    src="/assets/report.png"
                    alt="Report Icon"
                    width={15}
                    height={15}
                  />
                  <p className="opacity-60">{'Review Original Proposal'}</p>
                </Link>
              </div>
            </div>
          </Frame>

          <div className="z-50 flex flex-col gap-5 mb-[50px]">
            <Frame
              noPadding
              bottomLeft="0px"
              bottomRight="0px"
              topRight="0px"
              topLeft="0px"
            >
              <div
                id="team-container"
                className="w-full md:rounded-tl-[2vmax] md:p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section"
              >
                <div
                  id="project-team-container"
                  className="p-5 pb-0 md:p-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pr-12 "
                >
                  <div className="flex gap-5 opacity-[50%]">
                    <Image
                      src={'/assets/icon-team.svg'}
                      alt="Job icon"
                      width={30}
                      height={30}
                    />
                    <h2 className="header font-GoodTimes">Meet the Team</h2>
                  </div>
                  {isManager && (
                    <div
                      id="button-container"
                      className="pr-12 my-2 flex flex-col md:flex-row justify-start items-center gap-2"
                    >
                      <TeamManageMembers
                        hats={hats}
                        hatsContract={hatsContract}
                        teamContract={projectContract}
                        teamId={tokenId}
                        selectedChain={selectedChain}
                        multisigAddress={owner}
                        adminHatId={adminHatId}
                        managerHatId={managerHatId}
                      />
                    </div>
                  )}
                </div>

                <SlidingCardMenu>
                  <div className="flex gap-4">
                    {hats?.[0].id && (
                      <TeamMembers
                        hats={hats}
                        hatsContract={hatsContract}
                        citizenConract={citizenConract}
                      />
                    )}
                  </div>
                </SlidingCardMenu>
              </div>
            </Frame>
            {/* Mooney and Voting Power */}
            {isManager && (
              <TeamTreasury
                multisigAddress={owner}
                mutlisigMooneyBalance={MOONEYBalance}
                multisigNativeBalance={nativeBalance}
              />
            )}
          </div>
        </div>
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenId: any = params?.tokenId

  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)

  if (tokenId === undefined) {
    return {
      notFound: true,
    }
  }

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug],
    ProjectTableABI
  )
  const projectTableName = await projectTableContract?.call('getTableName')

  const statement = `SELECT * FROM ${projectTableName} WHERE id = ${tokenId}`

  const projectsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${statement}`
  )
  const projects = await projectsRes.json()
  const project = projects[0]

  if (!project || blockedProjects.includes(Number(tokenId))) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      project,
      tokenId,
    },
  }
}
