import ProposalsABI from 'const/abis/Proposals.json'
import { PROPOSALS_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { PROJECT_PENDING, PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'

export default function useProposalJSON(project: any) {
  const [proposalJSON, setProposalJSON] = useState<any>()
  useEffect(() => {
    async function fetchData() {
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()

      let ethBudget = 0
      if (proposal.budget) {
        proposal.budget.forEach((item: any) => {
          ethBudget += item.token === 'ETH' ? Number(item.amount) : 0
        })
      }
      proposal.ethBudget = ethBudget
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
