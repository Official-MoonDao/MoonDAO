import Safe from '@safe-global/protocol-kit'
import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROJECT_CREATOR_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { blockedProjects } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import useSafe from '@/lib/safe/useSafe'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client, { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import CollapsibleContainer from '@/components/layout/CollapsibleContainer'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamTreasury from '@/components/subscription/TeamTreasury'

type ProjectProfileProps = {
  tokenId: string
  project: Project
  safeOwners: string[]
}

export default function ProjectProfile({
  tokenId,
  project,
  safeOwners,
}: ProjectProfileProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  //Contracts
  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI as any,
    chain: selectedChain,
  })
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: selectedChain,
  })
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
    chain: selectedChain,
  })

  const [owner, setOwner] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    async function getOwner() {
      const owner: any = await readContract({
        contract: projectContract,
        method: 'ownerOf' as string,
        params: [tokenId],
      })
      setOwner(owner)
    }
    if (projectContract) getOwner()
  }, [tokenId, projectContract])

  const {
    adminHatId,
    managerHatId,
    isManager,
    isActive,
    nanceProposal,
    finalReportMarkdown,
    proposalJSON,
    totalBudget,
    MDP,
    isLoading: isLoadingProjectData,
  } = useProjectData(projectContract, hatsContract, project)

  const safeData = useSafe(owner)
  const isSigner = safeOwners.includes(address || '')
  //Hats
  const hats = useSubHats(selectedChain, adminHatId)

  useChainDefault()

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

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
        preFooter={
          <NoticeFooter 
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Need Help?"
            defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
            defaultButtonText="Submit a Ticket"
            defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            imageWidth={200}
            imageHeight={200}
          />
        }
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
              <div className="p-5 pb-0 md:p-0 flex flex-col items-start gap-5 pr-12">
                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                  <div className="flex gap-4 opacity-[50%]">
                    <Image
                      src={'/assets/icon-star.svg'}
                      alt="Star Icon"
                      width={30}
                      height={30}
                    />
                    <h2 className="header font-GoodTimes">Proposal</h2>
                  </div>

                  <Link
                    className="flex gap-2"
                    href={`/proposal/${MDP}`}
                    passHref
                  >
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

              <div className="py-4 px-4 md:px-0">
                <MarkdownWithTOC body={nanceProposal?.body || ''} />
              </div>
            </div>
          </Frame>
          {finalReportMarkdown && (
            <Frame
              noPadding
              bottomLeft="0px"
              bottomRight="0px"
              topRight="0px"
              topLeft="0px"
            >
              <div
                id="project-final-report-container"
                className={`w-full md:rounded-tl-[2vmax] md:p-5 md:pr-0 md:pb-14 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section transition-all duration-300`}
              >
                <div className="p-5 pb-0 md:p-0 flex items-center gap-5 pr-12 ">
                  <div className="flex gap-4 opacity-[50%]">
                    <Image
                      src={'/assets/icon-star.svg'}
                      alt="Star Icon"
                      width={30}
                      height={30}
                    />
                    <h2 className="header font-GoodTimes">Final Report</h2>
                  </div>
                </div>
                <div className="mt-4">
                  <MarkdownWithTOC body={finalReportMarkdown} />
                </div>
              </div>
            </Frame>
          )}

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
                        account={account}
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
                        citizenContract={citizenContract}
                      />
                    )}
                  </div>
                </SlidingCardMenu>
              </div>
            </Frame>
            {/* Mooney and Voting Power */}
            <TeamTreasury
              isSigner={isSigner}
              safeData={safeData}
              multisigAddress={owner}
              safeOwners={safeOwners}
            />
          </div>
        </div>
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenId: any = params?.tokenId

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  if (tokenId === undefined) {
    return {
      notFound: true,
    }
  }

  const projectTableContract = getContract({
    client: serverClient,
    address: PROJECT_TABLE_ADDRESSES[chainSlug],
    abi: ProjectTableABI as any,
    chain: chain,
  })

  const projectTableName = await readContract({
    contract: projectTableContract,
    method: 'getTableName' as string,
    params: [],
  })

  const statement = `SELECT * FROM ${projectTableName} WHERE id = ${tokenId}`

  const projects = await queryTable(chain, statement)
  const project = projects[0]

  if (!project || blockedProjects.includes(Number(tokenId))) {
    return {
      notFound: true,
    }
  }

  const projectContract = getContract({
    client: serverClient,
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectABI as any,
    chain: chain,
  })

  const safeAddress = await readContract({
    contract: projectContract,
    method: 'ownerOf' as string,
    params: [tokenId],
  })

  const rpcUrl = getRpcUrlForChain({
    client: serverClient,
    chain: chain,
  })

  const safe = await Safe.init({
    provider: rpcUrl,
    safeAddress: safeAddress,
  })

  const safeOwners = await safe.getOwners()

  return {
    props: {
      project,
      tokenId,
      safeOwners,
    },
  }
}
