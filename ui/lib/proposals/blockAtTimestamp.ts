/**
 * Resolve "what block was current at time T" per chain — the prerequisite
 * for using vMOONEY's truly-historical `balanceOfAt(addr, _block)` lookup
 * in the live render path. Once resolved (and cached per (chain,
 * timestamp)) the answer is permanent: blocks are append-only, so the
 * "highest block ≤ T" doesn't change after T has passed.
 *
 * Mirrors the same algorithm and Arbitrum L1/L2 fix-up that
 * `ui/scripts/snapshot-vmooney.mjs` uses for its --method=historical
 * captures. Kept as a library so the `nonProjectVote.ts` close handler
 * can persist `closeBlocks` per MDP automatically (no manual paste step
 * for the EB).
 *
 * Why per-chain RPCs instead of an indexer / Engine call: the binary
 * search requires ~25 fresh `eth_getBlockByNumber` calls per chain, and
 * Engine doesn't expose that primitive directly. Public RPCs handle it
 * fine and we cache aggressively at the module level so subsequent
 * calls within the same Vercel function instance are free.
 *
 * Arbitrum L1/L2 gotcha (same as in the snapshot script): on Arbitrum,
 * `block.number` returns the *L1* (Ethereum) block number, NOT the L2
 * block number. The vMOONEY contract's `balanceOfAt(addr, _block)`
 * does `assert _block <= block.number`, so passing an Arbitrum L2
 * block (in the 400M+ range) blows past the Ethereum block (~24M) and
 * the assertion reverts. Fix: for Arbitrum, use the Ethereum block at
 * the same wall-clock timestamp.
 */
import { ethers } from 'ethers'

export type CloseBlocksByChain = {
  arbitrum?: number
  ethereum?: number
  polygon?: number
  base?: number
}

type ChainConfig = {
  name: keyof CloseBlocksByChain
  rpc: string
}

// Mirror of the chains in `useTotalVMOONEY.fetchTotalVMOONEYs` — same
// four chains the live VP fetcher hits. Hardcoded to public RPCs so
// this lib stays infrastructure-light; the close handler runs server-
// side and any private RPC env config can be plugged in via the
// `RPC_OVERRIDES` map below if/when needed.
const VMOONEY_CHAINS: ChainConfig[] = [
  { name: 'arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'ethereum', rpc: 'https://ethereum-rpc.publicnode.com' },
  { name: 'polygon', rpc: 'https://polygon-bor-rpc.publicnode.com' },
  { name: 'base', rpc: 'https://base-rpc.publicnode.com' },
]

// `${chainName}:${timestamp}` → blockNumber. Module-scope so repeat
// resolutions within the same function instance are free. Cleared on
// cold start, which is fine — every fresh resolution is deterministic.
const blockAtTimestampCache = new Map<string, number>()

async function resolveBlockOnChain(
  chain: ChainConfig,
  targetTimestamp: number
): Promise<number> {
  const cacheKey = `${chain.name}:${targetTimestamp}`
  const cached = blockAtTimestampCache.get(cacheKey)
  if (cached != null) return cached

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc)
  const latestBlockNumber = await provider.getBlockNumber()
  const latestBlock = await provider.getBlock(latestBlockNumber)
  if (!latestBlock) {
    throw new Error(
      `[blockAtTimestamp] ${chain.name}: failed to fetch latest block ${latestBlockNumber}`
    )
  }
  if (latestBlock.timestamp < targetTimestamp) {
    // Target is in the future relative to the chain head. Should not
    // happen at close time (the 5-day window has elapsed by then) —
    // surface the error so the caller can fall back to live recompute.
    throw new Error(
      `[blockAtTimestamp] ${chain.name}: target ts ${targetTimestamp} is past ` +
        `latest block ${latestBlockNumber} (ts ${latestBlock.timestamp}). ` +
        `Cycle hasn't closed on this chain yet.`
    )
  }

  let lo = 1
  let hi = latestBlockNumber
  let best = lo
  // Hard cap iterations so a misbehaving RPC can't spin forever; log2
  // of any plausible chain height fits well under 64.
  for (let iter = 0; iter < 64 && lo <= hi; iter++) {
    const mid = Math.floor((lo + hi) / 2)
    let midBlock
    try {
      midBlock = await provider.getBlock(mid)
    } catch {
      // Some public RPCs prune deep history. Walk one step toward the
      // latest block and retry — the binary search converges anyway.
      lo = mid + 1
      continue
    }
    if (!midBlock) {
      lo = mid + 1
      continue
    }
    if (midBlock.timestamp <= targetTimestamp) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  blockAtTimestampCache.set(cacheKey, best)
  return best
}

/**
 * Resolve `block-at-close` on every vMOONEY chain in parallel.
 *
 * Returns an object keyed by chain slug with the L1 block number
 * appropriate for `balanceOfAt` — meaning Arbitrum's value is the
 * *Ethereum* block at the same timestamp, not the Arbitrum L2 block.
 * This is what the vMOONEY contract on Arbitrum expects (see header
 * comment for the full L1/L2 rationale).
 *
 * Throws if any chain fails to resolve. Refusing to silently
 * undercount is intentional: a partial `closeBlocks` map would
 * produce a vMOONEY total missing one chain's contribution, which
 * could flip a tally outcome. The close handler treats a throw here
 * as "skip the snapshot row write" — the on-chain `active` flip is
 * already locked, and the page falls back to the live (drift-prone)
 * `balanceOf(addr, _t)` path.
 */
export async function resolveCloseBlocks(
  voteCloseTimestamp: number
): Promise<CloseBlocksByChain> {
  const entries = await Promise.all(
    VMOONEY_CHAINS.map(async (c) => {
      const block = await resolveBlockOnChain(c, voteCloseTimestamp)
      return [c.name, block] as const
    })
  )
  const out: Record<string, number> = Object.fromEntries(entries)

  // Arbitrum L1/L2 fix-up: balanceOfAt on Arbitrum expects an L1 block
  // number. Override Arbitrum's value with Ethereum's block at the
  // same timestamp.
  if (out.arbitrum != null && out.ethereum != null) {
    out.arbitrum = out.ethereum
  }

  return out as CloseBlocksByChain
}
