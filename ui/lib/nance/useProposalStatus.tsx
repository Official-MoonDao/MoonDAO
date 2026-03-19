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
import { NANCE_API_URL, NANCE_SPACE_NAME } from '@/lib/nance/constants'

export type ProposalStatus =
  | 'Voting'
  | 'Cancelled'
  | 'Temperature Check'
  | 'Approved'
  | 'Archived'
  | 'Discussion'

// Map Nance API status strings to our ProposalStatus type
function mapNanceStatus(nanceStatus: string): ProposalStatus | undefined {
  const statusMap: Record<string, ProposalStatus> = {
    'Cancelled': 'Cancelled',
    'Approved': 'Approved',
    'Voting': 'Voting',
    'Temperature Check': 'Temperature Check',
    'Archived': 'Archived',
    'Discussion': 'Discussion',
  }
  return statusMap[nanceStatus]
}

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
      try {
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
        const onChainStatus = getProposalStatus(project.active, tempCheckApproved, tempCheckFailed)

        // If on-chain says "Temperature Check" (both tempCheck flags are false),
        // the contract data may be stale. Cross-reference with Nance API.
        if (onChainStatus === 'Temperature Check') {
          try {
            const res = await fetch(
              `${NANCE_API_URL}/${NANCE_SPACE_NAME}/proposal/${mdp}`
            )
            if (res.ok) {
              const data = await res.json()
              const nanceStatus = data?.data?.status
              const mapped = nanceStatus ? mapNanceStatus(nanceStatus) : undefined
              if (mapped && mapped !== 'Temperature Check') {
                setProposalStatus(mapped)
                return
              }
            }
          } catch {
            // Nance API unavailable, fall through to on-chain status
          }
        }

        setProposalStatus(onChainStatus)
      } catch {
        // Contract read failed, try Nance API as fallback
        try {
          const res = await fetch(
            `${NANCE_API_URL}/${NANCE_SPACE_NAME}/proposal/${mdp}`
          )
          if (res.ok) {
            const data = await res.json()
            const nanceStatus = data?.data?.status
            const mapped = nanceStatus ? mapNanceStatus(nanceStatus) : undefined
            if (mapped) {
              setProposalStatus(mapped)
              return
            }
          }
        } catch {
          // Both sources failed
        }
      }
    }
    fetchData()
  }, [project])

  return proposalStatus
}

export function getProposalStatus(
  active: number,
  tempCheckApproved: number,
  tempCheckFailed: number
) {
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
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    dot: 'bg-slate-500',
  },
}

/** Display label for "Vote Closed" instead of "Cancelled" */
export const STATUS_DISPLAY_LABELS: Partial<Record<ProposalStatus, string>> = {
  Cancelled: 'Vote Closed',
}
