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
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import { useENS } from '@/lib/utils/hooks/useENS'
import { PROJECT_PENDING, PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'
import { getProposalStatus, STATUS_CONFIG, STATUS_DISPLAY_LABELS, ProposalStatus } from '@/lib/nance/useProposalStatus'
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
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import CollapsibleContainer from '@/components/layout/CollapsibleContainer'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import DropDownMenu from '@/components/nance/DropDownMenu'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'
import ProposalVotes from '@/components/nance/ProposalVotes'
import { TokensOfProposal } from '@/components/nance/RequestingTokensOfProposal'
import VotingResults from '@/components/nance/VotingResults'
import ProposalEditSection from '@/components/nance/ProposalEditSection'
import TempCheck from '@/components/project/TempCheck'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamTreasury from '@/components/subscription/TeamTreasury'

function AuthorCitizenLink({
  authorAddress,
  citizenContract,
  authorName,
}: {
  authorAddress: string
  citizenContract: any
  authorName?: string | null
}) {
  const [citizenMeta, setCitizenMeta] = useState<any>(null)
  const { data: ensData } = useENS(authorAddress)
  const shortAddress = `${authorAddress.slice(0, 6)}...${authorAddress.slice(-4)}`

  useEffect(() => {
    async function resolve() {
      if (!authorAddress || !citizenContract?.address) return
      try {
        const tokenId = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [authorAddress],
        })
        const nft = await getNFT({
          contract: citizenContract,
          tokenId: BigInt(tokenId.toString()),
        })
        if (nft?.metadata?.name && nft.metadata.name !== 'Failed to load NFT metadata') {
          setCitizenMeta(nft.metadata)
        }
      } catch {
        // Not a citizen or contract call failed
      }
    }
    resolve()
  }, [authorAddress, citizenContract])

  const displayName = citizenMeta?.name || authorName || null
  const addressLabel = ensData?.name || shortAddress
  const avatarSrc =
    citizenMeta?.image || `https://cdn.stamp.fyi/avatar/${authorAddress}`
  const href = citizenMeta
    ? `/citizen/${generatePrettyLinkWithId(citizenMeta.name, citizenMeta.id)}`
    : undefined

  const etherscanUrl = `https://etherscan.io/address/${authorAddress}`

  return (
    <div className="flex items-center gap-3">
      <Link href={href || etherscanUrl} target={href ? undefined : '_blank'} rel={href ? undefined : 'noopener noreferrer'} className="no-underline">
        <div className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
            <img
              src={avatarSrc.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${avatarSrc.replace('ipfs://', '')}` : avatarSrc}
              alt={displayName || addressLabel}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          {displayName && (
            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
              {displayName}
            </span>
          )}
        </div>
      </Link>
      <Link
        href={href || etherscanUrl}
        target={href ? undefined : '_blank'}
        rel={href ? undefined : 'noopener noreferrer'}
        className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors no-underline"
      >
        {addressLabel}
      </Link>
    </div>
  )
}

function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  }
  const displayLabel = STATUS_DISPLAY_LABELS[status] ?? status
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} backdrop-blur-sm`}
    >
      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span
        className={`text-xs font-medium ${config.text} font-RobotoMono uppercase tracking-wider`}
      >
        {displayLabel}
      </span>
    </div>
  )
}

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

  const body = proposalJSON?.body || ''
  const submittedDate = body.match(/^Date:\s*(.+)$/m)?.[1]?.trim() || null
  const authorName = body.match(/^Author:\s*(.+)$/m)?.[1]?.trim() || null

  return (
    <Container>
      <Head title={project.name} description={project.description} />
      <ContentLayout
        header={project.name}
        headerSize="max(20px, 3vw)"
        description={
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <ProposalStatusBadge status={proposalStatus} />
              <span className="text-sm font-mono text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                MDP-{project.MDP}
              </span>
              {project.quarter && project.year && (
                <span className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                  Q{project.quarter} {project.year}
                </span>
              )}
              {submittedDate && (
                <span className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                  {submittedDate}
                </span>
              )}
              {proposalJSON?.budget && proposalJSON.budget.length > 0 && (
                <span className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                  Requesting: <span className="text-gray-200"><TokensOfProposal budget={proposalJSON.budget} /></span>
                </span>
              )}
              {proposalJSON?.authorAddress && (
                <AuthorCitizenLink
                  authorAddress={proposalJSON.authorAddress}
                  citizenContract={citizenContract}
                  authorName={authorName}
                />
              )}
            </div>

            <ProposalEditSection
              proposalJSON={proposalJSON}
              projectName={project.name}
              mdp={project.MDP}
            />
          </div>
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
        <div id="page-container" className="flex flex-col gap-6 py-6 md:py-8">
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
                {project.active == PROJECT_PENDING &&
                  proposalStatus === 'Temperature Check' && (
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
              projectActive={project.active}
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

    let projects = (
      await queryTable(chain, `SELECT * FROM ${projectTableName} WHERE MDP = ${tokenId}`)
    ).filter((p: Project) => !BLOCKED_PROJECTS.has(Number(p.id)))

    if (!projects[0]) {
      projects = (
        await queryTable(chain, `SELECT * FROM ${projectTableName} WHERE id = ${tokenId}`)
      ).filter((p: Project) => !BLOCKED_PROJECTS.has(Number(p.id)))
    }

    const project = projects[0]

    if (!project) {
      return {
        notFound: true,
      }
    }

    const mdp = project?.MDP

    let tempCheckApproved: any = false
    let tempCheckFailed: any = false
    let tempCheckApprovedTimestamp: any = '0'
    try {
      tempCheckApproved = await readContract({
        contract: proposalContract,
        method: 'tempCheckApproved' as string,
        params: [mdp],
      })
      tempCheckFailed = await readContract({
        contract: proposalContract,
        method: 'tempCheckFailed' as string,
        params: [mdp],
      })
      tempCheckApprovedTimestamp = await readContract({
        contract: proposalContract,
        method: 'tempCheckApprovedTimestamp' as string,
        params: [mdp],
      })
    } catch (error) {
      console.error(`Failed to read proposal contract for MDP ${mdp}:`, error)
    }

    let proposalStatus = getProposalStatus(project.active, tempCheckApproved, tempCheckFailed)

    if (proposalStatus === 'Temperature Check') {
      try {
        const { NANCE_API_URL, NANCE_SPACE_NAME } = await import('@/lib/nance/constants')
        const nanceRes = await fetch(`${NANCE_API_URL}/${NANCE_SPACE_NAME}/proposal/${mdp}`)
        if (nanceRes.ok) {
          const nanceData = await nanceRes.json()
          const nanceStatus = nanceData?.data?.status
          if (nanceStatus && nanceStatus !== 'Temperature Check') {
            proposalStatus = nanceStatus
          }
        }
      } catch {
        // Nance API unavailable, use on-chain status
      }
    }

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
      try {
        const voteStatement = `SELECT * FROM ${NON_PROJECT_PROPOSAL_TABLE_NAMES[chainSlug]} WHERE MDP = ${mdp}`
        votes = (await queryTable(chain, voteStatement)) as DistributionVote[]
        const voteAddresses = votes.map((v) => v.address)
        const votingPeriodClosedTimestamp = parseInt(tempCheckApprovedTimestamp) + 60 * 60 * 24 * 7

        if (voteAddresses.length > 0) {
          const vMOONEYs = await fetchTotalVMOONEYs(voteAddresses, votingPeriodClosedTimestamp)
          const addressToQuadraticVotingPower = Object.fromEntries(
            voteAddresses.map((address, index) => [address, Math.sqrt(vMOONEYs[index])])
          )
          const SUM_TO_ONE_HUNDRED = 100
          voteOutcome = runQuadraticVoting(votes, addressToQuadraticVotingPower, SUM_TO_ONE_HUNDRED)
        }
      } catch (error) {
        console.error('Error fetching votes:', error)
      }
    }

    let safeAddress = ''
    try {
      const projectContract = getContract({
        client: serverClient,
        address: PROJECT_ADDRESSES[chainSlug],
        abi: ProjectABI as any,
        chain: chain,
      })

      safeAddress = await readContract({
        contract: projectContract,
        method: 'ownerOf' as string,
        params: [project.id],
      })
    } catch (error) {
      console.error(`Failed to read ownerOf for project ${project.id}:`, error)
    }

    let safeOwners: string[] = []
    if (safeAddress) {
      try {
        const rpcUrl = getRpcUrlForChain({
          client: serverClient,
          chain: chain,
        })
        const safe = await Safe.init({
          provider: rpcUrl,
          safeAddress: safeAddress,
        })
        safeOwners = await safe.getOwners()
      } catch (error) {
        console.error('Error initializing Safe:', error)
      }
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
