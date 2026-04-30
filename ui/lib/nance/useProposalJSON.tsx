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
      //
      // Pass the project's MDP so author-negotiated budget overrides
      // (`BUDGET_OVERRIDES_USD`) propagate to the proposal card and
      // anywhere else this hook feeds — keeping the displayed number in
      // lock-step with what the server-side tally actually used.
      proposal.usdBudget = extractUsdBudget(proposal, { MDP: project?.MDP })
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
