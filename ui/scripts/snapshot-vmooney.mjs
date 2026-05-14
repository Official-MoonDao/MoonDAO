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
 *   # Force the projected (non-historical) method even for past cycles —
 *   # only useful for debugging / reproducing the buggy live behavior.
 *   node ui/scripts/snapshot-vmooney.mjs --kind=member --quarter=2 --year=2026 --method=projected
 *
 * Workflow
 * --------
 *
 *   1. After vote close (member: third Thursday of quarter + 5 days;
 *      retro: see `getRetroVoteCloseTimestamp`), run this script.
 *   2. It prints a JSON block ready to paste under the appropriate
 *      `*_VMOONEY_SNAPSHOTS` map in `lib/proposals/vMooneySnapshots.ts`.
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
  // diverge — e.g. Q2 2026's member vote actually closed 2026-05-01,
  // not the formula's 2026-04-21. Pass the real close as a unix
  // timestamp (seconds) and the snapshot pins it both in
  // `voteCloseTimestamp` (so the audit page displays the right date)
  // and as the `balanceOfAt` block-resolution target (so the values
  // reflect what actually counted).
  const voteCloseOverride = args['vote-close-timestamp']
    ? Number(args['vote-close-timestamp'])
    : null
  if (!['member', 'retro'].includes(kind)) {
    console.error(`Invalid --kind="${kind}" (expected "member" or "retro").`)
    process.exit(1)
  }
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    console.error(`Invalid --quarter="${args.quarter}" (expected 1-4).`)
    process.exit(1)
  }
  if (!Number.isInteger(year) || year < 2020) {
    console.error(`Invalid --year="${args.year}" (expected ≥2020).`)
    process.exit(1)
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
  return { kind, quarter, year, method, voteCloseOverride }
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
// (PROPOSALS_TABLE_NAMES / DISTRIBUTION_TABLE_NAMES, arbitrum slug). Hardcoded
// here so the script stays standalone with only `ethers` as a runtime
// dependency. If the table id ever rotates, update both places.
const PROPOSALS_TABLE = 'Proposals_42161_157'
const DISTRIBUTION_TABLE = 'DISTRIBUTION_42161_104'

const TABLELAND_QUERY_URL = 'https://tableland.network/api/v1/query'

async function fetchVoteAddresses(kind, quarter, year) {
  const table = kind === 'member' ? PROPOSALS_TABLE : DISTRIBUTION_TABLE
  const statement = `SELECT address FROM ${table} WHERE quarter=${quarter} AND year=${year}`
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
      `No votes found in ${table} for Q${quarter} ${year}. Did the cycle actually close?`
    )
  }
  // De-dupe and lowercase. The on-chain insert always lowercases via
  // `Strings.toHexString(msg.sender)`, but defensive normalization here
  // keeps the snapshot stable even if a row was ever inserted via a
  // different code path.
  const seen = new Set()
  const addresses = []
  for (const r of rows) {
    const addr = typeof r?.address === 'string' ? r.address.toLowerCase() : ''
    if (addr && !seen.has(addr)) {
      seen.add(addr)
      addresses.push(addr)
    }
  }
  return addresses
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
  if (latestBlock.timestamp <= targetTimestamp) {
    // Target is in the future relative to the chain head — `balanceOfAt`
    // would `assert _block <= block.number` and revert. Caller should
    // fall back to the projected method in this case.
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
      // Don't bail the whole script — most voters have 0 balance on most
      // chains anyway, and we want the run to surface partial results
      // rather than aborting on a single chain's RPC blip. The
      // per-voter loop treats this chain as 0, matching the production
      // fetcher's failure mode. Surface the warning loudly so the EB
      // can re-run if the affected chain matters for this cycle.
      console.error(
        `[snapshot-vmooney] WARNING: ${t.name} setup failed; balances on ` +
          `that chain will count as 0 in this snapshot.`,
        err?.message ?? err
      )
      ctx.status = 'failed'
    }
    contexts.push(ctx)
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
    } catch {
      // Most addresses don't have a balance on most chains. Treat any
      // read failure as 0 — same fallback the production fetcher uses.
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
  const { kind, quarter, year, method, voteCloseOverride } = parseArgs()
  const derivedVoteClose =
    kind === 'member'
      ? getMemberVoteCloseTimestamp(quarter, year)
      : getRetroVoteCloseTimestamp(quarter, year)
  const voteCloseTimestamp = voteCloseOverride ?? derivedVoteClose

  const closeIso = new Date(voteCloseTimestamp * 1000).toISOString()
  console.error(
    `[snapshot-vmooney] kind=${kind} cycle=Q${quarter} ${year} ` +
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

  const addresses = await fetchVoteAddresses(kind, quarter, year)
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
    quarter,
    year,
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
  }

  const mapName =
    kind === 'member'
      ? 'MEMBER_VOTE_VMOONEY_SNAPSHOTS'
      : 'RETRO_VMOONEY_SNAPSHOTS'

  console.error('')
  console.error(
    `Paste the JSON below as a new entry under \`${mapName}\` in ` +
      `ui/lib/proposals/vMooneySnapshots.ts (key: '${year}-Q${quarter}'):`
  )
  console.error('')
  // Print the entry to stdout so it can be redirected to a file. Headers
  // and progress lines go to stderr so they don't pollute the captured
  // JSON when piping (`> snapshot.json`).
  process.stdout.write(`'${year}-Q${quarter}': ${JSON.stringify(entry, null, 2)},\n`)
})().catch((err) => {
  console.error('[snapshot-vmooney] FAILED:', err)
  process.exit(1)
})
