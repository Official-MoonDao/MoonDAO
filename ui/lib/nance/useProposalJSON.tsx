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

      let usdBudget = 0
      if (proposal.budget) {
        proposal.budget.forEach((item: any) => {
          usdBudget += (item.token === 'USD' || item.token === 'USDC' || item.token === 'USDT' || item.token === 'DAI') ? Number(item.amount) : 0
        })
      }
      proposal.usdBudget = usdBudget
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
