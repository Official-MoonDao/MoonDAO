import { DAI_ADDRESSES, USDC_ADDRESSES, USDT_ADDRESSES } from 'const/config'
import { useEffect, useState } from 'react'
import { fetchProposalJsonCached } from '@/lib/ipfs/fetchProposalJsonCached'
import { extractUsdBudget } from '@/lib/proposals/extractUsdBudget'

// Flatten every known stablecoin address across every supported chain into
// a single lookup set. The shared extractor needs this to recognize
// `budget[].token` entries that store the token's CONTRACT ADDRESS rather
// than the symbol — the form `SafeTokenForm` actually writes today.
//
// Without it, proposals whose `totalBudgetUSDC` is missing/0 and whose
// budget items use addresses fall straight through to the markdown body
// parser, which silently returns 0 for proposals that don't have a
// parseable body table — leaving the dashboard, project cards, and the
// member-vote results panel showing $0 budgets that disagree with the
// server-side tally.
//
// Building a static, all-chains set is safe because EVM contract
// addresses are globally unique — there's no risk of an Arbitrum USDC
// address colliding with a Polygon DAI address, etc. — so we can stay
// chain-agnostic without threading chain context into the hook.
const STABLECOIN_ADDRESSES: ReadonlySet<string> = new Set(
  [
    ...Object.values(USDC_ADDRESSES),
    ...Object.values(USDT_ADDRESSES),
    ...Object.values(DAI_ADDRESSES),
  ]
    .filter((a): a is string => typeof a === 'string' && a.length > 0)
    .map((a) => a.toLowerCase())
)

export default function useProposalJSON(
  project: any,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const [proposalJSON, setProposalJSON] = useState<any>()
  useEffect(() => {
    if (!enabled || !project?.proposalIPFS) {
      // Clear any previously loaded proposal so parents that reuse this
      // component instance (e.g. index-keyed `ProjectCard`s on `/projects`)
      // don't keep rendering the prior project's author/title/budget while
      // heavy loading is deferred or the new row lacks a proposal.
      setProposalJSON(undefined)
      return
    }
    let cancelled = false
    async function fetchData() {
      try {
        const cached = await fetchProposalJsonCached(project.proposalIPFS)
        if (cancelled || !cached) return
        // Delegate to the shared extractor so the dashboard, project cards,
        // and the server-side member-vote tally all derive the budget the
        // same way.
        //
        // Pass the project's MDP so author-negotiated budget overrides
        // (`BUDGET_OVERRIDES_USD`) propagate to the proposal card and
        // anywhere else this hook feeds — keeping the displayed number in
        // lock-step with what the server-side tally actually used.
        //
        // Shallow-clone before assigning `usdBudget`: `fetchProposalJsonCached`
        // returns a shared reference across cards, and MDP-specific overrides
        // mean two cards on the same CID can compute different budgets — so
        // mutating the cached object would let the later run stomp the
        // earlier card's displayed value on the next parent re-render.
        const proposal = {
          ...cached,
          usdBudget: extractUsdBudget(cached, {
            stablecoinAddresses: STABLECOIN_ADDRESSES,
            MDP: project?.MDP,
          }),
        }
        setProposalJSON(proposal)
      } catch {
        // Leave proposalJSON undefined; card falls back to tableland fields.
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [project, enabled])

  return proposalJSON
}
