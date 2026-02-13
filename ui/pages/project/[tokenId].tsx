import Safe from '@safe-global/protocol-kit'
import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROJECT_CREATOR_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  PROPOSALS_ADDRESSES,
  NON_PROJECT_PROPOSAL_TABLE_NAMES,
} from 'const/config'
import { BLOCKED_PROJECTS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import { PROJECT_PENDING, PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'
import { getProposalStatus } from '@/lib/nance/useProposalStatus'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import useSafe from '@/lib/safe/useSafe'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client, { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import CollapsibleContainer from '@/components/layout/CollapsibleContainer'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import DropDownMenu from '@/components/nance/DropDownMenu'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import ProposalInfo from '@/components/nance/ProposalInfo'
import ProposalVotes from '@/components/nance/ProposalVotes'
import VotingResults from '@/components/nance/VotingResults'
import ProposalEditSection from '@/components/nance/ProposalEditSection'
import TempCheck from '@/components/project/TempCheck'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamTreasury from '@/components/subscription/TeamTreasury'

type ProjectProfileProps = {
  tokenId: string
  project: Project
  safeAddress: string
  safeOwners: string[]
  proposalJSON: any
  votes: any[]
  voteOutcome: any
  proposalStatus: any
}

export default function ProjectProfile({
  tokenId,
  project,
  safeAddress,
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

  const [isExpanded, setIsExpanded] = useState(false)

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

  const safeData = useSafe(safeAddress)
  const isSigner = safeOwners.includes(address || '')
  //Hats
  const hats = useSubHats(selectedChain, adminHatId, true)

  useChainDefault()

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }
  const tallyVotes = async () => {
    const res = await fetch(`/api/proposals/nonProjectVote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
              className="flex flex-col lg:flex-row items-start lg:items-center gap-4 px-4 md:px-0"
            >
              <div id="team-name-container" className="w-full">
                <div id="profile-container" className="w-full">
                  {project?.description ? (
                    <p
                      id="profile-description-container"
                      className="mb-5 w-full lg:w-[80%] text-sm md:text-base"
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
        description={
          <ProposalInfo
            proposalJSON={proposalJSON}
            proposalStatus={proposalStatus}
            project={project}
            linkDisabled
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
        <div id="page-container" className="flex flex-col gap-6 p-6 md:p-8 max-w-[1200px]">
          {finalReportMarkdown && (
            <SectionCard header="Final Report" iconSrc="/assets/icon-star.svg">
              <div className="prose prose-invert max-w-none">
                <MarkdownWithTOC body={finalReportMarkdown} />
              </div>
            </SectionCard>
          )}
          {/* Project Overview */}
          <SectionCard
            header="Proposal"
            iconSrc="/assets/icon-star.svg"
            action={
              <div className="flex gap-2 items-center">
                {(project.active == PROJECT_PENDING &&
                  proposalStatus === 'Temperature Check') || true && (
                  <div className="flex items-center gap-2">
                    <TempCheck mdp={project.MDP} />
                  </div>
                )}
                {project.active == PROJECT_PENDING &&
                  proposalStatus === 'Voting' &&
                  proposalJSON?.nonProjectProposal && (
                    <div className="flex items-center">
                      <ProposalVotes
                        project={project}
                        votes={votes}
                        proposalStatus={proposalStatus}
                      />
                    </div>
                  )}
                <DropDownMenu project={project} proposalStatus={proposalStatus} />
              </div>
            }
          >
            <div className="mt-10 mb-10">
              <ProposalEditSection
                proposalJSON={proposalJSON}
                projectName={project.name}
                mdp={project.MDP}
              />
              <div className="prose prose-invert max-w-none">
                <MarkdownWithTOC body={proposalJSON.body || ''} />
              </div>
            </div>
          </SectionCard>

          {/* Voting Results Section - Only show for completed proposals */}
          {project.active !== PROJECT_PENDING && proposalJSON?.nonProjectProposal && (
            <SectionCard
              header="Voting Results"
              iconSrc="/assets/icon-star.svg"
            >
              <div className="bg-dark-cool lg:bg-darkest-cool rounded-[20px] p-5">
                <VotingResults voteOutcome={voteOutcome} votes={votes} threshold={0} />
              </div>
            </SectionCard>
          )}

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
                    multisigAddress={safeAddress}
                    adminHatId={adminHatId}
                    managerHatId={managerHatId}
                  />
                </div>
              )
            }
          >
            <SlidingCardMenu>
              <div className="flex gap-2 md:gap-4">
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
          <SectionCard header="Treasury" iconSrc="/assets/icon-treasury.svg">
            <TeamTreasury
              isSigner={isSigner}
              safeData={safeData}
              multisigAddress={safeAddress}
              safeOwners={safeOwners}
            />
          </SectionCard>
        </div>
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
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

    const statement = `SELECT * FROM ${projectTableName} WHERE MDP = ${tokenId}`

  const projects = (await queryTable(chain, statement)).filter(
    (p: Project) => !BLOCKED_PROJECTS.has(Number(p.id))
  )
  const project = projects[0]

    if (!project) {
      return {
        notFound: true,
      }
    }

    const mdp = project?.MDP
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
    
    let proposalJSON: any = {}
    try {
      const proposalResponse = await fetch(project.proposalIPFS)
      if (!proposalResponse.ok) {
        console.error(`Failed to fetch proposal IPFS: ${proposalResponse.status}`)
      } else {
        proposalJSON = await proposalResponse.json()
      }
    } catch (error) {
      console.error('Error fetching proposal IPFS:', error)
    }

    let votes: DistributionVote[] = []
    let voteOutcome = {}
    if (proposalJSON?.nonProjectProposal) {
      const voteStatement = `SELECT * FROM ${NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
      votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
      const voteAddresses = votes.map((v) => v.address)
      const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 7
      
      // Only fetch vMOONEY if there are votes
      if (voteAddresses.length > 0) {
        const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, votingPeriodClosedTimestamp)
        const addressToQuadraticVotingPower = Object.fromEntries(
          voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
        )
        const SUM_TO_ONE_HUNDRED = 100
        voteOutcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)
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
      params: [project.id],
    })

    const rpcUrl = getRpcUrlForChain({
      client: serverClient,
      chain: chain,
    })

    let safeOwners: string[] = []
    try {
      const safe = await Safe.init({
        provider: rpcUrl,
        safeAddress: safeAddress,
      })
      safeOwners = await safe.getOwners()
    } catch (error) {
      console.error('Error initializing Safe:', error)
    }

    return {
      props: {
        project,
        tokenId,
        safeAddress,
        safeOwners,
        votes,
        proposalStatus,
        proposalJSON,
        voteOutcome,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps:', error)
    return {
      notFound: true,
    }
  }
}
