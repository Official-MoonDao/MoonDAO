import JobBoardTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import { JOBS_TABLE_ADDRESSES, MARKETPLACE_TABLE_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { useContext } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { toProjectOwnerId } from '@/lib/project/projectOwnerId'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import TeamJobs from '@/components/subscription/TeamJobs'
import TeamMarketplace from '@/components/subscription/TeamMarketplace'

type ProjectJobsAndMarketplaceProps = {
  section: 'jobs' | 'marketplace'
  projectId: number
  selectedChain: any
  /** Project managers and the project lead. Their writes go through the operator relay. */
  canManage: boolean
  isActive: boolean
}

export default function ProjectJobsAndMarketplace({
  section,
  projectId,
  selectedChain,
  canManage,
  isActive,
}: ProjectJobsAndMarketplaceProps) {
  const { citizen } = useContext(CitizenContext)
  const chainSlug = getChainSlug(selectedChain)
  const ownerId = String(toProjectOwnerId(projectId))

  const jobTableContract = useContract({
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    abi: JobBoardTableABI,
    chain: selectedChain,
  })
  const marketplaceTableContract = useContract({
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    abi: MarketplaceTableABI,
    chain: selectedChain,
  })
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
    chain: selectedChain,
  })

  if (section === 'marketplace') {
    return (
      <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
        <TeamMarketplace
          selectedChain={selectedChain}
          marketplaceTableContract={marketplaceTableContract}
          teamContract={teamContract}
          teamId={ownerId}
          isManager={canManage}
          isCitizen={citizen}
        />
      </div>
    )
  }

  if (!isActive && !canManage) {
    return (
      <p className="text-slate-300 text-center py-8">
        This project isn&apos;t active, so it has no open roles.
      </p>
    )
  }

  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
      {canManage && (
        <p className="text-slate-300 text-sm px-6 pt-6">
          {isActive
            ? 'Roles you post appear on the MoonDAO job board while this project is active.'
            : 'This project is inactive, so its roles are hidden from the job board.'}
        </p>
      )}
      <TeamJobs
        teamId={ownerId}
        jobTableContract={jobTableContract}
        isManager={canManage}
        isCitizen={citizen}
        showWhenEmpty
      />
    </div>
  )
}
