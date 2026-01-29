import { useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import ProposalsABI from 'const/abis/Proposals.json'
import { SENATORS_LIST, Senator, DEFAULT_CHAIN_V5 } from 'const/config'
import { engineMulticall, EngineReadParams } from '@/lib/thirdweb/engine'
import { getChainSlug } from '@/lib/thirdweb/chain'

export interface SenatorVoteStatus extends Senator {
  hasVoted: boolean
  votedApprove: boolean
  votedDeny: boolean
}

export default function useProposalData(proposalContract: any, mdp: any) {
  const account = useActiveAccount()
  const address = account?.address

  // Get senators list immediately using DEFAULT_CHAIN_V5
  const senatorsChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const defaultSenators = SENATORS_LIST[senatorsChainSlug] || []

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [proposalData, setProposalData] = useState<any>({})
  // Initialize with default senators (all showing as not voted)
  const [senatorVotes, setSenatorVotes] = useState<SenatorVoteStatus[]>(() => 
    defaultSenators.map(s => ({ ...s, hasVoted: false, votedApprove: false, votedDeny: false }))
  )

  async function getProposalData() {
    if (!proposalContract?.address || !proposalContract?.chain) return

    setIsLoading(true)
    try {
      const contractAddress = proposalContract.address
      const chain = proposalContract.chain
      const chainId = chain.id
      const abi = ProposalsABI.abi
      // Use DEFAULT_CHAIN_V5 for senators list to ensure consistency
      const senatorsChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
      const senators = SENATORS_LIST[senatorsChainSlug] || []

      // Base params that don't require a user address
      const baseParams: EngineReadParams[] = [
        {
          contractAddress,
          method: 'tempCheckVoteCount',
          params: [mdp],
          abi,
        },
        {
          contractAddress,
          method: 'tempCheckApprovalCount',
          params: [mdp],
          abi,
        },
        {
          contractAddress,
          method: 'tempCheckApproved',
          params: [mdp],
          abi,
        },
        {
          contractAddress,
          method: 'tempCheckFailed',
          params: [mdp],
          abi,
        },
      ]

      // User-specific params that require an address
      const userParams: EngineReadParams[] = address ? [
        {
          contractAddress,
          method: 'tempCheckVoteApprove',
          params: [mdp, address],
          abi,
        },
        {
          contractAddress,
          method: 'tempCheckVoteDeny',
          params: [mdp, address],
          abi,
        },
      ] : []

      // Senator vote status params - check each senator's vote
      const senatorVoteParams: EngineReadParams[] = senators.flatMap((senator) => [
        {
          contractAddress,
          method: 'tempCheckVoteApprove',
          params: [mdp, senator.address],
          abi,
        },
        {
          contractAddress,
          method: 'tempCheckVoteDeny',
          params: [mdp, senator.address],
          abi,
        },
      ])

      const params = [...baseParams, ...userParams, ...senatorVoteParams]
      const results = await engineMulticall<{ result: any }>(params, { chainId })

      const baseResultsCount = 4
      const userResultsCount = address ? 2 : 0
      const senatorResultsStart = baseResultsCount + userResultsCount

      // Parse senator vote statuses
      const senatorVoteStatuses: SenatorVoteStatus[] = senators.map((senator, index) => {
        const approveResult = results[senatorResultsStart + index * 2]?.result
        const denyResult = results[senatorResultsStart + index * 2 + 1]?.result
        return {
          ...senator,
          votedApprove: Boolean(approveResult),
          votedDeny: Boolean(denyResult),
          hasVoted: Boolean(approveResult) || Boolean(denyResult),
        }
      })

      setSenatorVotes(senatorVoteStatuses)

      setProposalData({
        tempCheckVoteCount: results[0]?.result,
        tempCheckApprovalCount: results[1]?.result,
        tempCheckApproved: results[2]?.result,
        tempCheckFailed: results[3]?.result,
        // User-specific data only available when signed in
        ...(address && {
          tempCheckApprove: results[4]?.result,
          tempCheckDeny: results[5]?.result,
        }),
      })
    } catch (error) {
      console.error('Failed to fetch proposal data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (proposalContract && mdp) getProposalData()
  }, [mdp, proposalContract, address])

  const refetch = () => {
    getProposalData()
  }

  return {
    proposalData,
    senatorVotes,
    isLoading,
    refetch,
  }
}
