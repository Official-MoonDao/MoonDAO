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

      const params: EngineReadParams[] = [
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

      const results = await engineMulticall<{ result: any }>(params, { chainId })

      setProposalData({
        tempCheckVoteCount: results[0]?.result,
        tempCheckApprovalCount: results[1]?.result,
        tempCheckApprove: results[2]?.result,
        tempCheckDeny: results[3]?.result,
        tempCheckApproved: results[4]?.result,
        tempCheckFailed: results[5]?.result,
      })
    } catch (error) {
      console.error('Failed to fetch proposal data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (proposalContract && mdp && address) getProposalData()
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
