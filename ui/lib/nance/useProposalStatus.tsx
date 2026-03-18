import { useEffect, useState } from 'react'
import ProposalsABI from 'const/abis/Proposals.json'
import client from '@/lib/thirdweb/client'
import { PROPOSALS_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { IS_SENATE_VOTE } from 'const/config'
import {
  PROJECT_PENDING,
  PROJECT_ACTIVE,
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
    if (!project || project?.MDP == null || project?.MDP === undefined) {
      setProposalStatus('Archived')
      return
    }
    const mdp = project.MDP
    if (
      !client ||
      !chain ||
      !chainSlug ||
      !(chainSlug in PROPOSALS_ADDRESSES) ||
      !ProposalsABI?.abi
    ) {
      setProposalStatus('Archived')
      return
    }
    const proposalAddress = PROPOSALS_ADDRESSES[chainSlug]
    if (!proposalAddress) {
      setProposalStatus('Archived')
      return
    }
    const mdpNum = Number(mdp)
    if (Number.isNaN(mdpNum) || mdpNum < 0) {
      setProposalStatus('Archived')
      return
    }
    const proposalContract = getContract({
      client: client,
      address: proposalAddress,
      abi: ProposalsABI.abi as any,
      chain: chain,
    })
    async function fetchData() {
      try {
        const mdpParam = BigInt(mdpNum)
        const tempCheckApproved = await readContract({
          contract: proposalContract,
          method: 'tempCheckApproved' as string,
          params: [mdpParam],
        })
        const tempCheckFailed = await readContract({
          contract: proposalContract,
          method: 'tempCheckFailed' as string,
          params: [mdpParam],
        })
        const status = getProposalStatus(project.active, tempCheckApproved, tempCheckFailed)
        setProposalStatus(status)
      } catch (err) {
        console.warn('[useProposalStatus] Failed to fetch proposal status:', err)
        setProposalStatus('Archived')
      }
    }
    fetchData().catch(() => setProposalStatus('Archived'))
  }, [project])

  return proposalStatus
}

/** Normalize contract bool (can be boolean, BigInt, or string from RPC/Engine) */
function isTruthy(value: unknown): boolean {
  if (value == null || value === undefined) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'string')
    return value === 'true' || value === '1' || value === '0x1'
  if (typeof value === 'bigint') return value !== 0n
  if (typeof value === 'number') return value !== 0
  return Boolean(value)
}

export function getProposalStatus(
  active: number,
  tempCheckApproved: unknown,
  tempCheckFailed: unknown
) {
  const approved = isTruthy(tempCheckApproved)
  const failed = isTruthy(tempCheckFailed)

  let status: ProposalStatus = 'Archived'
  if (Number(active) === PROJECT_PENDING) {
    if (approved) {
      status = 'Voting'
    } else if (failed) {
      status = 'Cancelled'
    } else {
      // Only show "Temperature Check" when Senate Vote phase is active (IS_SENATE_VOTE=true)
      status = IS_SENATE_VOTE ? 'Temperature Check' : 'Archived'
    }
  } else if (Number(active) === PROJECT_VOTE_FAILED) {
    status = 'Cancelled'
  } else if (Number(active) === PROJECT_ACTIVE) {
    status = 'Approved'
  }
  return status
}

/** Display label for proposal status (e.g. "Archived" -> "Vote ended") */
export function getProposalStatusLabel(status: ProposalStatus | string | undefined): string {
  if (!status) return 'Vote ended'
  return status === 'Archived' ? 'Vote ended' : String(status)
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
