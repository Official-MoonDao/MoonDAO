import { useEffect, useMemo, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'

export default function useProposalData(proposalContract: any, mdp: any) {
  const account = useActiveAccount()
  const address = account?.address

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [proposalData, setProposalData] = useState<any>({})
  async function getProposalData() {
    const [
      tempCheckVoteCount,
      tempCheckApprovalCount,
      tempCheckApprove,
      tempCheckDeny,
      tempCheckApproved,
      tempCheckFailed,
    ] = await Promise.all([
      readContract({
        contract: proposalContract,
        method: 'tempCheckVoteCount' as string,
        params: [mdp],
      }),
      readContract({
        contract: proposalContract,
        method: 'tempCheckApprovalCount' as string,
        params: [mdp],
      }),
      readContract({
        contract: proposalContract,
        method: 'tempCheckVoteApprove' as string,
        params: [mdp, address],
      }),
      readContract({
        contract: proposalContract,
        method: 'tempCheckVoteDeny' as string,
        params: [mdp, address],
      }),
      readContract({
        contract: proposalContract,
        method: 'tempCheckApproved' as string,
        params: [mdp],
      }),
      readContract({
        contract: proposalContract,
        method: 'tempCheckFailed' as string,
        params: [mdp],
      }),
    ])
    setProposalData({
      tempCheckVoteCount: tempCheckVoteCount,
      tempCheckApprovalCount: tempCheckApprovalCount,
      tempCheckApprove: tempCheckApprove,
      tempCheckDeny: tempCheckDeny,
      tempCheckApproved: tempCheckApproved,
      tempCheckFailed: tempCheckFailed,
    })
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
