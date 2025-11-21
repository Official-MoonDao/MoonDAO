import { useEffect, useState } from 'react'
import ProposalsABI from 'const/abis/Proposals.json'
import client from '@/lib/thirdweb/client'
import { PROPOSALS_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import {
  PROJECT_PENDING,
  PROJECT_ACTIVE,
  PROJECT_ENDED,
  PROJECT_VOTE_FAILED,
} from '@/lib/nance/types'
import { getChainSlug } from '@/lib/thirdweb/chain'

export type ProposalStatus =
  | 'Voting'
  | 'Cancelled'
  | 'Temperature Check'
  | 'Approved'
  | 'Archived'
  | 'Discussion'
export function useProposalStatus(project: any) {
  const [proposalStatus, setProposalStatus] = useState<any>()
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  useEffect(() => {
    const mdp = project.MDP
    const proposalContract = getContract({
      client: client,
      address: PROPOSALS_ADDRESSES[chainSlug],
      abi: ProposalsABI.abi as any,
      chain: chain,
    })
    async function fetchData() {
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
      const status = getProposalStatus(project.active, tempCheckApproved, tempCheckFailed)
      setProposalStatus(status)
    }
    fetchData()
  }, [project])

  return proposalStatus
}

export function getProposalStatus(active, tempCheckApproved, tempCheckFailed) {
  let status: ProposalStatus = 'Archived'
  if (active == PROJECT_PENDING) {
    if (tempCheckApproved) {
      status = 'Voting'
    } else if (tempCheckFailed) {
      status = 'Cancelled'
    } else {
      status = 'Temperature Check'
    }
  } else if (active == PROJECT_VOTE_FAILED) {
    status = 'Cancelled'
  } else if (active == PROJECT_ACTIVE) {
    status = 'Approved'
  }
  return status
}

export const STATUS_CONFIG = {
  Voting: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
  },
  'Temperature Check': {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    dot: 'bg-orange-500',
  },
  Archived: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
  },
  Approved: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-500',
  },
  Discussion: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
  },
  Cancelled: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-500',
  },
}
