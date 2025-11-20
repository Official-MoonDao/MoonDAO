import { useEffect, useState } from 'react'
import ProposalsABI from 'const/abis/Proposals.json'
import client from '@/lib/thirdweb/client'
import { PROPOSALS_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { PROJECT_PENDING, PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'
import { getChainSlug } from '@/lib/thirdweb/chain'

export default function useProposalStatus(project: any) {
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
      let status = ''
      if (project.active == PROJECT_PENDING) {
        if (tempCheckApproved) {
          status = 'Voting'
        } else if (tempCheckFailed) {
          status = 'Cancelled'
        } else {
          status = 'Temperature Check'
        }
      } else if (project.active == PROJECT_ACTIVE) {
        status = 'Approved'
      } else {
        status = 'Archived'
      }
      setProposalStatus(status)
    }
    fetchData()
  }, [project])

  return proposalStatus
}
