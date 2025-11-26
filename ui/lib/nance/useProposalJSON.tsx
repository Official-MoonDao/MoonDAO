import { useEffect, useState } from 'react'
import ProposalsABI from 'const/abis/Proposals.json'
import client from '@/lib/thirdweb/client'
import { PROPOSALS_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { PROJECT_PENDING, PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'
import { getChainSlug } from '@/lib/thirdweb/chain'

export default function useProposalStatus(project: any) {
  const [proposalJSON, setProposalJSON] = useState<any>()
  useEffect(() => {
    async function fetchData() {
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
