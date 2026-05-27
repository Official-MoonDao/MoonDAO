/**
 * Capture a frozen vMOONEY voting-power snapshot for a single voting cycle
 * and emit a paste-ready entry for `lib/proposals/vMooneySnapshots.ts`.
 *
 * Why this exists
 * ---------------
 * The on-chain vMOONEY contract has TWO timestamp-aware balance methods,
 * and they give different answers for the same `(address, voteCloseTime)`
 * tuple after a voter's lock changes:
 *
 *   balanceOf(addr, _t)
 *     Extrapolates from the LATEST `user_point_history` entry — i.e.
 *     "take the most recent point and decay it back to time _t". Any
 *     state change AFTER the vote (increase amount, extend lock,
 *     withdraw post-expiry) replaces the latest point and silently
 *     rewrites what `balanceOf(addr, voteCloseTimestamp)` returns. Not
 *     actually historical.
 *
 *   balanceOfAt(addr, _block)
 *     Binary-searches through `user_point_history` to find the point
 *     that was current at block `_block`, then decays from there. Truly
 *     historical — the answer is fixed once the cycle's blocks land.
 *
 * The compute pipeline used to call the FIRST method on every audit
 * page load, which is why the public audit at `/projects/audit` was
 * silently changing for past cycles. This script captures the SECOND
 * method's value (per chain, at the block-at-vote-close on that chain)
 * and emits a paste-ready snapshot. Pinning the result in
 * `vMooneySnapshots.ts` makes the audit deterministic going forward AND
 * recovers the original audit values for cycles that have already
 * drifted.
 *
 * Usage
 * -----
 *
 *   # Recover a PAST cycle exactly as it was at vote close (uses
 *   # balanceOfAt + per-chain block-at-timestamp lookup):
 *   node ui/scripts/snapshot-vmooney.mjs --kind=member --quarter=2 --year=2026
 *
 *   # Snapshot the CURRENT cycle (vote close still in the future). Falls
 *   # back to balanceOf(addr, _t) since the historical block doesn't
 *   # exist yet on every chain. Capture again after close to get the
 *   # truly-historical values.
 *   node ui/scripts/snapshot-vmooney.mjs --kind=retro --quarter=1 --year=2026
 *
 *   # Per-MDP Member Vote on a Senate-approved proposal. Reads
 *   # `tempCheckApprovedTimestamp(mdp)` from `Proposals.sol` on Arbitrum
 *   # and adds 5 days to derive the canonical close moment, mirroring
 *   # the formula in `pages/api/proposals/nonProjectVote.ts`. Pin under
 *   # `MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS`, keyed by the MDP integer.
 *   node ui/scripts/snapshot-vmooney.mjs --kind=memberProposal --mdp=249
 *
 *   # Force the projected (non-historical) method even for past cycles —
 *   # only useful for debugging / reproducing the buggy live behavior.
 *   node ui/scripts/snapshot-vmooney.mjs --kind=member --quarter=2 --year=2026 --method=projected
 *
 * Workflow
 * --------
 *
 *   1. After vote close (member: third Thursday of quarter + 5 days;
 *      retro: see `getRetroVoteCloseTimestamp`), run this script.
 *   2. It prints a JSON block (with `vMOONEY` per-voter balances AND
 *      `distributions` per-voter Tableland row) ready to paste under
 *      the appropriate `*_VMOONEY_SNAPSHOTS` map in
 *      `lib/proposals/vMooneySnapshots.ts`. Pinning both keeps the
 *      audit drift-proof against vMOONEY lock changes AND post-close
 *      Tableland row edits.
 *   3. Open the file, paste the entry keyed by `${year}-Q${quarter}`,
 *      commit, and deploy. From that deploy onward the audit for that
 *      cycle is frozen.
 *
 * For PAST cycles whose audit has already drifted, the same workflow
 * applies — running the script with `--method=historical` (the default)
 * recovers the original at-vote-close values via `balanceOfAt(_block)`.
 *
 * Standalone by design — the only Node import is `ethers` so it can run
 * without the full Next stack. Tableland queries hit the public gateway;
 * vMOONEY balances are read directly from each chain's RPC. No HSM /
 * Vercel secrets required.
 */
import { ethers } from 'ethers'

// =============================================================================
// CLI args
// =============================================================================
function parseArgs() {
  const args = {}
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([\w-]+)=(.*)$/)
    if (m) args[m[1]] = m[2]
  }
  const kind = args.kind || 'member'
  const quarter = Number(args.quarter)
  const year = Number(args.year)
  const mdp = args.mdp != null ? Number(args.mdp) : NaN
  // `historical` (default) → balanceOfAt(addr, blockNumber).
  // `projected`            → balanceOf(addr, timestamp). Same as the
  //                          buggy live fetcher; only useful for
  //                          debugging or pinning a future cycle whose
  //                          historical block doesn't exist yet.
  const method = args.method || 'historical'
  // Override for the auto-derived vote-close timestamp. The default
  // formula in this script (`getMemberVoteCloseTimestamp` /
  // `getRetroVoteCloseTimestamp`) mirrors what the production compute
  // pipeline derives, but the *actual* governance close moment can
  // diverge — e.g. Q2 2026's member vote used the canonical close
  // 2026-04-20 00:00 UTC (`1776643200`), not the formula's 2026-04-21.
  // Pass the real close as a unix timestamp (seconds) and the snapshot
  // pins it both in `voteCloseTimestamp` (so the audit page displays
  // the right date) and as the `balanceOfAt` block-resolution target
  // (so the values reflect what actually counted).
  const voteCloseOverride = args['vote-close-timestamp']
    ? Number(args['vote-close-timestamp'])
    : null
  if (!['member', 'retro', 'memberProposal'].includes(kind)) {
    console.error(
      `Invalid --kind="${kind}" (expected "member", "retro", or "memberProposal").`
    )
    process.exit(1)
  }
  // memberProposal is keyed by MDP, not (quarter, year). The other two
  // are still cycle-keyed.
  if (kind === 'memberProposal') {
    if (!Number.isInteger(mdp) || mdp <= 0) {
      console.error(
        `Invalid --mdp="${args.mdp}" (required for --kind=memberProposal; expected a positive integer).`
      )
      process.exit(1)
    }
  } else {
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      console.error(`Invalid --quarter="${args.quarter}" (expected 1-4).`)
      process.exit(1)
    }
    if (!Number.isInteger(year) || year < 2020) {
      console.error(`Invalid --year="${args.year}" (expected ≥2020).`)
      process.exit(1)
    }
  }
  if (!['historical', 'projected'].includes(method)) {
    console.error(
      `Invalid --method="${method}" (expected "historical" or "projected").`
    )
    process.exit(1)
  }
  if (
    voteCloseOverride != null &&
    (!Number.isFinite(voteCloseOverride) || voteCloseOverride <= 0)
  ) {
    console.error(
      `Invalid --vote-close-timestamp="${args['vote-close-timestamp']}" ` +
        `(expected a positive unix timestamp in seconds).`
    )
    process.exit(1)
  }
  return { kind, quarter, year, mdp, method, voteCloseOverride }
}

// =============================================================================
// Tableland config
// =============================================================================
//
// Hardcoded to the production Arbitrum chain (slug 42161). Member-vote
// distributions live in the `Proposals_*` table; retro distributions in
// the `DISTRIBUTION_*` table. Both have the same shape: one row per
// (quarter, year, voter) with a JSON `distribution` blob.
// Must mirror the production table names in `const/config.ts`
// (PROPOSALS_TABLE_NAMES / DISTRIBUTION_TABLE_NAMES /
// NON_PROJECT_PROPOSAL_TABLE_NAMES, arbitrum slug). Hardcoded here so
// the script stays standalone with only `ethers` as a runtime
// dependency. If any table id ever rotates, update both places.
const PROPOSALS_TABLE = 'Proposals_42161_157'
const DISTRIBUTION_TABLE = 'DISTRIBUTION_42161_104'
const NON_PROJECT_PROPOSAL_TABLE = 'NonProjectProposal_42161_154'

// Mainnet Proposals contract on Arbitrum. Used by the memberProposal
// path to read `tempCheckApprovedTimestamp(mdp)` so we can derive the
// canonical close moment without the user having to pass
// `--vote-close-timestamp` by hand. Mirror of
// `PROPOSALS_ADDRESSES.arbitrum` in `ui/const/config.ts`.
const PROPOSALS_CONTRACT_ARBITRUM = '0xaA928a1189b9320D23754f1D36B6C67d676fd6FE'
const PROPOSALS_ABI_FRAGMENT = [
  'function tempCheckApprovedTimestamp(uint256) view returns (uint256)',
  'function tempCheckApproved(uint256) view returns (bool)',
]

const TABLELAND_QUERY_URL = 'https://tableland.network/api/v1/query'

/**
 * Fetch the (address, distribution) rows for a cycle. Returns
 * { addresses, distributions } where:
 *
 *   addresses     unique lowercased voter addresses, in row order
 *   distributions { lowercased address → { projectId → percent } }
 *
 * The distributions are returned alongside the addresses so the caller
 * can pin them in the snapshot, freezing the audit against post-close
 * Tableland edits in the same way `vMOONEY` freezes voting power.
 */
async function fetchVoteRows(kind, quarter, year, mdp) {
  // Three table variants. The cycle-keyed cases query by (quarter, year)
  // and read a `distribution` column; the per-MDP case queries by MDP
  // and reads a `vote` column (mirrors the column names in
  // `lib/tableland/types.ts:DistributionVote`).
  let table
  let column
  let where
  let cycleLabel
  if (kind === 'member') {
    table = PROPOSALS_TABLE
    column = 'distribution'
    where = `quarter=${quarter} AND year=${year}`
    cycleLabel = `Q${quarter} ${year}`
  } else if (kind === 'retro') {
    table = DISTRIBUTION_TABLE
    column = 'distribution'
    where = `quarter=${quarter} AND year=${year}`
    cycleLabel = `Q${quarter} ${year}`
  } else {
    table = NON_PROJECT_PROPOSAL_TABLE
    column = 'vote'
    where = `MDP=${mdp}`
    cycleLabel = `MDP-${mdp}`
  }
  const statement = `SELECT address, ${column} FROM ${table} WHERE ${where}`
  const url = `${TABLELAND_QUERY_URL}?statement=${encodeURIComponent(statement)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `Tableland query failed (${res.status}) for ${table}: ${await res.text()}`
    )
  }
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      `No votes found in ${table} for ${cycleLabel}. Did the cycle actually close?`
    )
  }
  // De-dupe and lowercase. The on-chain insert always lowercases via
  // `Strings.toHexString(msg.sender)`, but defensive normalization here
  // keeps the snapshot stable even if a row was ever inserted via a
  // different code path.
  const seen = new Set()
  const addresses = []
  const distributions = {}
  for (const r of rows) {
    const addr = typeof r?.address === 'string' ? r.address.toLowerCase() : ''
    if (!addr || seen.has(addr)) continue
    seen.add(addr)
    addresses.push(addr)

    // The Tableland gateway returns the JSON column as a parsed object
    // for some validators and as a string for others. Handle both, and
    // strip any non-finite/negative values so the pinned snapshot only
    // contains the cleaned shape the compute pipeline expects.
    const raw = r[column]
    let parsed
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw) } catch { parsed = {} }
    } else if (raw && typeof raw === 'object') {
      parsed = raw
    } else {
      parsed = {}
    }
    const clean = {}
    for (const [pid, value] of Object.entries(parsed)) {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) clean[pid] = n
    }
    distributions[addr] = clean
  }
  return { addresses, distributions }
}

/**
 * Read the canonical close moment for a per-MDP Member Vote: the
 * Senate's `tempCheckApprovedTimestamp` plus a 5-day voting window.
 *
 * Mirrors the formula in `ui/pages/api/proposals/nonProjectVote.ts` so
 * snapshots line up with what the on-chain tally uses. Reads from
 * Arbitrum mainnet — the only chain Proposals.sol is deployed on for
 * production.
 */
async function getMemberProposalVoteCloseTimestamp(mdp) {
  const arb = VMOONEY_TOKENS.find((t) => t.name === 'arbitrum')
  if (!arb) {
    throw new Error(
      `[snapshot-vmooney] internal: no arbitrum entry in VMOONEY_TOKENS`
    )
  }
  const provider = new ethers.providers.JsonRpcProvider(arb.rpc)
  const proposals = new ethers.Contract(
    PROPOSALS_CONTRACT_ARBITRUM,
    PROPOSALS_ABI_FRAGMENT,
    provider
  )
  const approved = await proposals.tempCheckApproved(mdp)
  if (!approved) {
    throw new Error(
      `[snapshot-vmooney] MDP-${mdp} hasn't passed Senate Temperature Check ` +
        `(tempCheckApproved=false). There's nothing to snapshot until the ` +
        `Senate vote tallies and a Member Vote actually opens.`
    )
  }
  const tempCheckApprovedTs = await proposals.tempCheckApprovedTimestamp(mdp)
  const ts = Number(tempCheckApprovedTs.toString())
  if (!Number.isFinite(ts) || ts <= 0) {
    throw new Error(
      `[snapshot-vmooney] MDP-${mdp} returned invalid ` +
        `tempCheckApprovedTimestamp=${ts}. Refusing to derive a close moment ` +
        `from junk; pass --vote-close-timestamp explicitly if needed.`
    )
  }
  return ts + 60 * 60 * 24 * 5
}

// =============================================================================
// vMOONEY config
// =============================================================================
//
// Mirror of the production `useTotalVMOONEY.fetchTotalVMOONEYs` config:
// the same four chains, same VotingEscrow addresses. We sum the per-chain
// balances (failures count as 0, matching the production fallback) so the
// snapshot is comparable to what the live fetcher would have produced at
// vote-close time.
const VMOONEY_TOKENS = [
  { name: 'arbitrum', addr: '0xB255c74F8576f18357cE6184DA033c6d93C71899', rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'ethereum', addr: '0xCc71C80d803381FD6Ee984FAff408f8501DB1740', rpc: 'https://ethereum-rpc.publicnode.com' },
  { name: 'polygon',  addr: '0xe2d1BFef0A642B717d294711356b468ccE68BEa6', rpc: 'https://polygon-bor-rpc.publicnode.com' },
  { name: 'base',     addr: '0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBAcF5', rpc: 'https://base-rpc.publicnode.com' },
]
const VMOONEY_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function balanceOf(address, uint256) view returns (uint256)',
  'function balanceOfAt(address, uint256) view returns (uint256)',
  // Used by the per-voter sanity check that distinguishes "no
  // user_points yet" (legitimate 0) from real reverts (silent
  // undercount). Required for the empty-data revert classification
  // in `getTotalVMooney`.
  'function user_point_epoch(address) view returns (uint256)',
  'function user_point_history(address, uint256) view returns (int128 bias, int128 slope, uint256 ts, uint256 blk)',
]

// =============================================================================
// Block-at-timestamp binary search
// =============================================================================
//
// We need the highest block whose `timestamp <= targetTimestamp` on each
// chain. `ethereum-block-by-date` exists (and ships in this repo's
// `package.json`), but it pulls in extra deps and we want this script to
// stay zero-dependency beyond `ethers`. A direct binary search is
// straightforward and gets us within ~25 RPC calls per chain (log2 of
// each chain's block height), cached per-chain so repeat lookups across
// voters are free.
//
// We bias the search to "highest block ≤ target" so the resulting block
// is the LAST one included in the cycle window. `balanceOfAt` requires
// `_block <= block.number` — the search guarantees this.
const blockAtTimestampCache = new Map() // `${chainName}:${timestamp}` → number

async function getBlockAtTimestamp(provider, chainName, targetTimestamp) {
  const cacheKey = `${chainName}:${targetTimestamp}`
  const cached = blockAtTimestampCache.get(cacheKey)
  if (cached != null) return cached

  const latestBlockNumber = await provider.getBlockNumber()
  const latestBlock = await provider.getBlock(latestBlockNumber)
  if (latestBlock.timestamp < targetTimestamp) {
    // Target is strictly in the future relative to the chain head —
    // `balanceOfAt` would `assert _block <= block.number` and revert.
    // Caller should fall back to the projected method in this case.
    // Equality (latest == target) is fine: the latest block IS the
    // highest block ≤ targetTimestamp, and the binary search below
    // will converge on it.
    throw new Error(
      `Target timestamp ${targetTimestamp} is past the latest ${chainName} ` +
        `block (${latestBlock.timestamp}). Cycle hasn't closed on this chain yet.`
    )
  }

  let lo = 1
  let hi = latestBlockNumber
  let best = lo
  // Hard cap iterations so a misbehaving RPC can't spin forever. log2 of
  // any plausible chain height fits well under 64.
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

// Per-chain provider + block-at-vote-close cache. Resolved once up front
// so each voter doesn't trigger a fresh binary search per chain.
//
// Arbitrum L1/L2 block-number gotcha
// ----------------------------------
// On Arbitrum, `block.number` (and `_block` parameters in storage like
// `user_point_history.blk`) refer to the L1 (Ethereum) block number,
// NOT the Arbitrum L2 block number. The vMOONEY contract's
// `balanceOfAt(addr, _block)` does `assert _block <= block.number`,
// which on Arbitrum means "≤ the latest L1 block this Arbitrum tx
// sees". Passing the L2 block (in the 400M+ range) blows past the L1
// block (in the 24M range) and the assert reverts — silently
// returning 0 if the caller swallows errors. That silently undercounts
// every voter's Arbitrum balance.
//
// Fix: for Arbitrum, use the Ethereum block-at-timestamp as the
// `balanceOfAt` argument. The Ethereum block height matches what the
// Arbitrum contract's `block.number` would have returned at the L2
// block at the same wall-clock moment, so it both passes the assert
// and resolves to the correct historical user_point.
async function resolveChainContexts(method, voteCloseTimestamp) {
  const contexts = []
  for (const t of VMOONEY_TOKENS) {
    const ctx = { ...t, provider: null, contract: null, blockAtClose: null, status: 'pending' }
    try {
      ctx.provider = new ethers.providers.JsonRpcProvider(t.rpc)
      ctx.contract = new ethers.Contract(t.addr, VMOONEY_ABI, ctx.provider)
      if (method === 'historical') {
        ctx.blockAtClose = await getBlockAtTimestamp(
          ctx.provider,
          t.name,
          voteCloseTimestamp
        )
        console.error(
          `[snapshot-vmooney] resolved block at close on ${t.name}: ` +
            `block #${ctx.blockAtClose} ≤ ts ${voteCloseTimestamp}`
        )
      }
      ctx.status = 'ready'
    } catch (err) {
      // RPC/setup failure (provider down, address malformed, etc.) is
      // a HARD failure — not "0 balance". Bail loudly; the EB needs
      // to re-run with a working RPC for that chain rather than
      // silently shipping an undercounted snapshot.
      throw new Error(
        `[snapshot-vmooney] FATAL: ${t.name} setup failed (RPC: ${t.rpc}). ` +
          `Re-run when the chain is reachable, or substitute a working RPC. ` +
          `Refusing to silently undercount.\nUnderlying: ${err?.message ?? err}`
      )
    }
    contexts.push(ctx)
  }

  // Arbitrum L1/L2 fix-up. After all per-chain blocks are resolved
  // via timestamp, override the Arbitrum block with the Ethereum
  // block at the same timestamp. See header comment above.
  if (method === 'historical') {
    const arb = contexts.find((c) => c.name === 'arbitrum')
    const eth = contexts.find((c) => c.name === 'ethereum')
    if (arb && eth && eth.blockAtClose != null) {
      console.error(
        `[snapshot-vmooney] arbitrum block fix-up: ` +
          `L2 block #${arb.blockAtClose} → L1 block #${eth.blockAtClose} ` +
          `(balanceOfAt on Arbitrum expects an L1 block number)`
      )
      arb.blockAtClose = eth.blockAtClose
    }
  }

  return contexts
}

async function getTotalVMooney(address, voteCloseTimestamp, contexts, method) {
  let total = 0
  for (const ctx of contexts) {
    if (ctx.status !== 'ready') continue
    try {
      let bal
      if (method === 'historical' && ctx.blockAtClose != null) {
        bal = await ctx.contract['balanceOfAt(address,uint256)'](
          address,
          ctx.blockAtClose
        )
      } else {
        bal = await ctx.contract['balanceOf(address,uint256)'](
          address,
          voteCloseTimestamp
        )
      }
      total += parseFloat(ethers.utils.formatEther(bal))
    } catch (err) {
      // Distinguish "no user_points yet" (legitimate 0) from real
      // contract reverts (silent undercount). The Curve-style
      // VotingEscrow `balanceOfAt` reverts with empty data when the
      // address has no points before `_block` — we sanity-check via
      // `user_point_epoch` and only treat empty-data reverts as 0
      // when the voter genuinely has no history at this block.
      const isEmptyDataRevert =
        err?.code === 'CALL_EXCEPTION' && (err?.data === '0x' || err?.data == null)
      if (!isEmptyDataRevert) {
        throw new Error(
          `[snapshot-vmooney] FATAL: ${ctx.name} balanceOfAt(${address}, ` +
            `${ctx.blockAtClose}) errored unexpectedly. Refusing to silently ` +
            `undercount.\nUnderlying: ${err?.message ?? err}`
        )
      }
      // Empty-data revert: most likely "no user_points before _block".
      // Confirm by checking user_point_epoch — if the voter has any
      // points whose `blk` is ≤ `ctx.blockAtClose`, then a 0 here is
      // wrong and we should bail.
      try {
        const epoch = await ctx.contract.user_point_epoch(address)
        if (Number(epoch.toString()) > 0) {
          const firstPoint = await ctx.contract.user_point_history(address, 1)
          const firstBlk = Number(firstPoint.blk.toString())
          if (firstBlk <= ctx.blockAtClose) {
            throw new Error(
              `[snapshot-vmooney] FATAL: ${ctx.name} balanceOfAt(${address}, ` +
                `${ctx.blockAtClose}) reverted but voter's first point on this ` +
                `chain is at L1-block ${firstBlk} ≤ ${ctx.blockAtClose}. ` +
                `This indicates a real contract problem (or the wrong block ` +
                `number was passed). Refusing to silently undercount.`
            )
          }
        }
      } catch (sanityErr) {
        if (String(sanityErr?.message ?? '').startsWith('[snapshot-vmooney] FATAL')) {
          throw sanityErr
        }
        // user_point_epoch lookup itself failed — don't bail on the
        // sanity-check infrastructure (the chain may not match this
        // exact ABI shape on every contract version), but log it so a
        // human can investigate.
        console.error(
          `[snapshot-vmooney] WARNING: ${ctx.name} sanity check after revert ` +
            `failed; treating as 0 (voter ${address}). ${sanityErr?.message ?? sanityErr}`
        )
      }
    }
  }
  return total
}

// =============================================================================
// Vote-close timestamp derivation
// =============================================================================
//
// Mirrors `getThirdThursdayOfQuarterTimestamp` (member) and
// `getRetroVoteCloseTimestamp` (retro) so the snapshot's
// `voteCloseTimestamp` matches what the compute pipeline derives. If
// these helpers ever change in the app, mirror the change here too.
function getThirdThursdayOfQuarterTimestamp(quarter, year) {
  const startMonth = (quarter - 1) * 3
  const date = new Date(year, startMonth, 1)
  const THURSDAY = 4
  const dow = date.getDay()
  const daysToFirstThursday = (THURSDAY - dow + 7) % 7
  date.setDate(date.getDate() + daysToFirstThursday + 14) // first + 2 weeks
  return Math.floor(date.getTime() / 1000)
}

function getMemberVoteCloseTimestamp(quarter, year) {
  const open = getThirdThursdayOfQuarterTimestamp(quarter, year)
  return open + 60 * 60 * 24 * 5 // +5 days
}

function getRetroVoteCloseTimestamp(quarter, year) {
  const nextQuarterIndex = quarter % 4
  const nextQuarterYear = quarter === 4 ? year + 1 : year
  const nextQuarterStart = new Date(Date.UTC(nextQuarterYear, nextQuarterIndex * 3, 1))
  const fourteenIn = new Date(nextQuarterStart)
  fourteenIn.setUTCDate(fourteenIn.getUTCDate() + 14)
  const TUESDAY = 2
  const dow = fourteenIn.getUTCDay()
  // `|| 7` mirrors `daysUntilDay`'s `daysUntil === 0 ? 7 : daysUntil` —
  // when day-14 itself is a Tuesday, advance to the next Tuesday so the
  // snapshot timestamp matches `isRewardsCycle`'s window edge.
  const daysUntilTuesday = ((TUESDAY - dow + 7) % 7) || 7
  const close = new Date(fourteenIn)
  close.setUTCDate(close.getUTCDate() + daysUntilTuesday)
  return Math.floor(close.getTime() / 1000)
}

// =============================================================================
// Main
// =============================================================================
;(async () => {
  const { kind, quarter, year, mdp, method, voteCloseOverride } = parseArgs()
  let derivedVoteClose
  if (kind === 'member') {
    derivedVoteClose = getMemberVoteCloseTimestamp(quarter, year)
  } else if (kind === 'retro') {
    derivedVoteClose = getRetroVoteCloseTimestamp(quarter, year)
  } else {
    // memberProposal: derive from Proposals.sol on Arbitrum unless
    // explicitly overridden via --vote-close-timestamp. Skip the RPC
    // read in that case so an offline / archived run can still emit
    // a snapshot without hitting the contract.
    derivedVoteClose =
      voteCloseOverride != null
        ? voteCloseOverride
        : await getMemberProposalVoteCloseTimestamp(mdp)
  }
  const voteCloseTimestamp = voteCloseOverride ?? derivedVoteClose

  const closeIso = new Date(voteCloseTimestamp * 1000).toISOString()
  const cycleLabel =
    kind === 'memberProposal' ? `MDP-${mdp}` : `Q${quarter} ${year}`
  console.error(
    `[snapshot-vmooney] kind=${kind} cycle=${cycleLabel} ` +
      `voteCloseTimestamp=${voteCloseTimestamp} (${closeIso}) method=${method}`
  )
  if (voteCloseOverride != null && voteCloseOverride !== derivedVoteClose) {
    const derivedIso = new Date(derivedVoteClose * 1000).toISOString()
    console.error(
      `[snapshot-vmooney] using --vote-close-timestamp=${voteCloseOverride} ` +
        `instead of derived ${derivedVoteClose} (${derivedIso}). ` +
        `The pinned snapshot will record the override so the audit displays it.`
    )
  }

  const now = Math.floor(Date.now() / 1000)
  if (now < voteCloseTimestamp && method === 'historical') {
    console.error(
      `[snapshot-vmooney] ERROR: vote close is ${voteCloseTimestamp - now}s in the future ` +
        `but --method=historical requires the close block to exist on every chain. ` +
        `Re-run after vote close, or pass --method=projected for an in-flight preview ` +
        `(value will not be truly historical and may drift before the cycle ends).`
    )
    process.exit(1)
  }

  const { addresses, distributions } = await fetchVoteRows(
    kind,
    quarter,
    year,
    mdp
  )
  console.error(
    `[snapshot-vmooney] ${addresses.length} unique voter address(es) to snapshot.`
  )

  const contexts = await resolveChainContexts(method, voteCloseTimestamp)
  // If every chain failed to resolve we'd produce a snapshot full of
  // zeros — refuse to emit that since pasting it into the constants
  // file would silently lock in a 0-power tally.
  if (contexts.every((c) => c.status !== 'ready')) {
    throw new Error(
      'All four vMOONEY chains failed to resolve. Refusing to emit an all-zero snapshot. ' +
        'Check RPC reachability and re-run.'
    )
  }

  const vMOONEY = {}
  for (const addr of addresses) {
    const total = await getTotalVMooney(addr, voteCloseTimestamp, contexts, method)
    vMOONEY[addr] = total
    console.error(`  ${addr}: ${total.toFixed(4)} vMOONEY`)
  }

  const entry = {
    // Per-MDP snapshots key off `mdp`, not `(quarter, year)`. Emit only
    // the relevant key so the pasted entry matches the constants-file
    // schema exactly without leaving stale `quarter: NaN` fields behind.
    ...(kind === 'memberProposal'
      ? { mdp }
      : { quarter, year }),
    voteCloseTimestamp,
    snapshotTakenAt: Math.floor(Date.now() / 1000),
    // Record which method produced these numbers so the EB (and any
    // future debugger) can tell at a glance whether the snapshot is
    // truly historical or just a projected freeze.
    method,
    // Per-chain block heights used for the historical lookup, so an
    // auditor can independently re-derive the same numbers via any
    // explorer or local node. Empty when --method=projected.
    blockAtClose:
      method === 'historical'
        ? Object.fromEntries(
            contexts
              .filter((c) => c.blockAtClose != null)
              .map((c) => [c.name, c.blockAtClose])
          )
        : undefined,
    vMOONEY,
    // Frozen distributions captured alongside vMOONEY. Including these
    // makes the audit fully drift-proof: even if a voter's Tableland
    // row is later edited (re-opened submissions window, manual owner
    // write, etc.), the compute pipeline reads from this map instead.
    // The map is in lowercased-address → projectId → percent shape and
    // is a verbatim copy of what the Proposals/DISTRIBUTION_ table
    // returned at capture time.
    distributions,
  }

  let mapName
  let entryKey
  if (kind === 'member') {
    mapName = 'MEMBER_VOTE_VMOONEY_SNAPSHOTS'
    entryKey = `'${year}-Q${quarter}'`
  } else if (kind === 'retro') {
    mapName = 'RETRO_VMOONEY_SNAPSHOTS'
    entryKey = `'${year}-Q${quarter}'`
  } else {
    mapName = 'MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS'
    // Per-MDP map is keyed by integer (no quotes).
    entryKey = `${mdp}`
  }

  console.error('')
  console.error(
    `Paste the JSON below as a new entry under \`${mapName}\` in ` +
      `ui/lib/proposals/vMooneySnapshots.ts (key: ${entryKey}):`
  )
  console.error('')
  // Print the entry to stdout so it can be redirected to a file. Headers
  // and progress lines go to stderr so they don't pollute the captured
  // JSON when piping (`> snapshot.json`).
  process.stdout.write(`${entryKey}: ${JSON.stringify(entry, null, 2)},\n`)
})().catch((err) => {
  console.error('[snapshot-vmooney] FAILED:', err)
  process.exit(1)
})
