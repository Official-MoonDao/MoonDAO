import Safe from '@safe-global/protocol-kit'
import CitizenABI from 'const/abis/Citizen.json'
import ProposalInfo from '@/components/nance/ProposalInfo'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import VotingResults from '@/components/nance/VotingResults'
import ProposalVotes from '@/components/nance/ProposalVotes'
import ProposalsABI from 'const/abis/Proposals.json'
import DropDownMenu from '@/components/nance/DropDownMenu'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROJECT_CREATOR_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  PROPOSALS_ADDRESSES,
  PROPOSALS_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_PROJECTS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import { getProposalStatus } from '@/lib/nance/useProposalStatus'
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
import SectionCard from '@/components/layout/SectionCard'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamTreasury from '@/components/subscription/TeamTreasury'
import { PROJECT_PENDING, PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'
import TempCheck from '@/components/project/TempCheck'

type ProjectProfileProps = {
  tokenId: string
  project: Project
  safeOwners: string[]
  proposalJSON: any
  votes: any[]
  voteOutcome: any
  proposalStatus: any
}

export default function ProjectProfile({
  tokenId,
  project,
  safeOwners,
  proposalJSON,
  votes,
  voteOutcome,
  proposalStatus,
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
    finalReportMarkdown,
    totalBudget,
    MDP,
    isLoading: isLoadingProjectData,
  } = useProjectData(projectContract, hatsContract, project)

  const safeData = useSafe(owner)
  const isSigner = safeOwners.includes(address || '')
  //Hats
  const hats = useSubHats(selectedChain, adminHatId, true)

  useChainDefault()

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }
  const tallyVotes = async () => {
    const res = await fetch(`/api/proposals/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Important: Specify the content type
      },
      body: JSON.stringify({
        mdp: project?.MDP,
      }),
    })
    const resJson = await res.json()
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
          <div id="frame-content" className="w-full flex flex-col items-start justify-between">
            <div
              id="profile-description-section"
              className="flex flex-col lg:flex-row items-start lg:items-center gap-4"
            >
              <div id="team-name-container">
                <div id="profile-container">
                  {project?.description ? (
                    <p id="profile-description-container" className="mb-5 w-full lg:w-[80%]">
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
  const gridCols = votes ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'

  return (
    <Container>
      <Head title={project.name} description={project.description} />
      <ContentLayout
        header={project.name}
        headerSize="max(20px, 3vw)"
        description={
          <ProposalInfo
            proposalJSON={proposalJSON}
            proposalStatus={proposalStatus}
            project={project}
            linkDisabled
            sponsorDisabled={false}
            coauthorsDisabled={false}
            showTitle={false}
            showStatus={true}
          />
          //'prop'
        }
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
          className="animate-fadeIn flex flex-col gap-6 w-full max-w-[1080px]"
        >
          {/* Project Overview */}
          <SectionCard header="Proposal" iconSrc="/assets/icon-star.svg">
            <div className="mt-10 mb-10">
              <div className={`grid ${gridCols} gap-8`}>
                <div className="lg:col-span-2 relative">
                  <div className="absolute top-2 right-[20px]">
                    <DropDownMenu project={project} proposalStatus={proposalStatus} />
                  </div>
                  <div>
                    <MarkdownWithTOC body={proposalJSON.body || ''} />
                  </div>
                </div>
                <div className="mt-[-40px] md:mt-0 bg-dark-cool lg:bg-darkest-cool rounded-[20px] flex flex-col h-fit">
                  <div className="px-[10px] p-5">
                    {project.active == PROJECT_PENDING ? (
                      proposalStatus === 'Temperature Check' ? (
                        <TempCheck mdp={project.MDP} />
                      ) : (
                        <>
                          <ProposalVotes
                            project={project}
                            votes={votes}
                            proposalStatus={proposalStatus}
                            refetch={() => mutate()}
                          />
                          {/*FIXME run on cron */}
                          <button onClick={tallyVotes}>Tally votes</button>
                        </>
                      )
                    ) : (
                      <VotingResults
                        votingInfo={{
                          scores_total: 100,
                          scores: [voteOutcome[1], voteOutcome[2], voteOutcome[3]],
                          state: 'closed',
                        }}
                        votesData={[]}
                        threshold={0}
                        onRefetch={() => mutate()}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
          {finalReportMarkdown && (
            <SectionCard header="Final Report" iconSrc="/assets/icon-star.svg">
              <div className="prose prose-invert max-w-none">
                <MarkdownWithTOC body={finalReportMarkdown} />
              </div>
            </SectionCard>
          )}

          <div className="z-50 flex flex-col gap-6 mb-[50px]">
            <SectionCard
              header="Meet the Team"
              iconSrc="/assets/icon-team.svg"
              action={
                isManager && (
                  <div className="flex flex-col md:flex-row justify-start items-center gap-2">
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
                )
              }
            >
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
            </SectionCard>
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
  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain: chain,
  })

  const statement = `SELECT * FROM ${projectTableName} WHERE id = ${tokenId}`

  const projects = await queryTable(chain, statement)
  const project = projects[0]

  if (!project || BLOCKED_PROJECTS.has(Number(tokenId))) {
    return {
      notFound: true,
    }
  }

  const mdp = project.MDP
  const tempCheckApproved = await readContract({
    contract: proposalContract,
    method: 'tempCheckApproved' as string,
    params: [mdp],
  })
  const tempCheckFailed = await readContract({
    contract: proposalContract,
    method: 'tempCheckFailed' as string,
    params: [mdp],
  })
  const tempCheckApprovedTimestamp = await readContract({
    contract: proposalContract,
    method: 'tempCheckApprovedTimestamp' as string,
    params: [mdp],
  })
  const proposalStatus = getProposalStatus(project.active, tempCheckApproved, tempCheckFailed)
  const voteStatement = `SELECT * FROM ${PROPOSALS_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
  const votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
  const voteAddresses = votes.map((pv) => pv.address)
  const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 7
  const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, votingPeriodClosedTimestamp)
  const addressToQuadraticVotingPower = Object.fromEntries(
    voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
  )
  const SUM_TO_ONE_HUNDRED = 100
  const voteOutcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)

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
  const proposalResponse = await fetch(project.proposalIPFS)
  const proposalJSON = await proposalResponse.json()

  return {
    props: {
      project,
      tokenId,
      safeOwners,
      votes,
      proposalStatus,
      proposalJSON,
      voteOutcome,
    },
  }
}
