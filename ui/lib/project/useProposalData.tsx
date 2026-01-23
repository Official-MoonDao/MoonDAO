import { useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import ProposalsABI from 'const/abis/Proposals.json'
import { engineMulticall, EngineReadParams } from '@/lib/thirdweb/engine'

export default function useProposalData(proposalContract: any, mdp: any) {
  const account = useActiveAccount()
  const address = account?.address

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [proposalData, setProposalData] = useState<any>({})

  async function getProposalData() {
    if (!proposalContract?.address || !proposalContract?.chain?.id) return

    setIsLoading(true)
    try {
      const contractAddress = proposalContract.address
      const chainId = proposalContract.chain.id
      const abi = ProposalsABI.abi

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

      const params = [...baseParams, ...userParams]
      const results = await engineMulticall<{ result: any }>(params, { chainId })

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
    isLoading,
    refetch,
  }
}
