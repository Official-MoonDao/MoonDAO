import { useEffect, useState } from 'react'
import { extractUsdBudget } from '@/lib/proposals/extractUsdBudget'

export default function useProposalJSON(project: any) {
  const [proposalJSON, setProposalJSON] = useState<any>()
  useEffect(() => {
    async function fetchData() {
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()
      // Delegate to the shared extractor so the dashboard, project cards,
      // and the server-side member-vote tally all derive the budget the
      // same way. The hook intentionally doesn't pass a stablecoin address
      // set: the consumers that need it (the tally) supply their chain's
      // set themselves; on the client we only need the symbol-and-body
      // resolution path that's worked here historically.
      proposal.usdBudget = extractUsdBudget(proposal)
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
