/**
 * Frozen vMOONEY voting-power snapshots, keyed by (kind, quarter, year).
 *
 * ============================================================================
 * Why this exists
 * ============================================================================
 *
 * The vMOONEY VotingEscrow contract has TWO timestamp-aware balance methods,
 * and they give different answers for the same `(addr, voteCloseTime)`
 * tuple after a voter's lock changes:
 *
 *   balanceOf(addr, _t)
 *     Extrapolates from the LATEST `user_point_history` entry — i.e.
 *     "take the most recent point and decay it back to time _t". Any
 *     state change AFTER the vote (increase amount, extend lock,
 *     withdraw post-expiry) replaces the latest point and silently
 *     rewrites what `balanceOf(addr, voteCloseTimestamp)` returns. NOT
 *     actually historical. This is what the live `fetchTotalVMOONEYs`
 *     fetcher uses, which is why the audit was drifting.
 *
 *   balanceOfAt(addr, _block)
 *     Binary-searches through `user_point_history` to find the point
 *     that was current at block `_block`, then decays from there. Truly
 *     historical — the answer is fixed once the cycle's blocks land.
 *     `ui/scripts/snapshot-vmooney.mjs` uses this to capture snapshots.
 *
 * Approach: snapshot each cycle's voting power once after vote close (via
 * `balanceOfAt` against the block-at-close on each chain) and pin it
 * here as a constant. The compute pipeline reads from the snapshot for
 * any (quarter, year) that has one and only falls back to the live
 * `fetchTotalVMOONEYs` for the active cycle (where no snapshot exists
 * yet). Past cycles become deterministic regardless of subsequent lock
 * activity, AND past cycles whose audit has already drifted can be
 * recovered to their original at-vote-close values.
 *
 * ============================================================================
 * Recovering a PAST cycle whose audit has drifted
 * ============================================================================
 *
 * If a cycle closed weeks ago and its audit numbers have shifted because
 * voters changed their locks since, run:
 *
 *     npm --prefix ui run snapshot:vmooney -- \
 *         --kind=member --quarter=2 --year=2026
 *
 * The script defaults to `--method=historical`, which:
 *   1. Resolves the block-at-vote-close on each of the 4 vMOONEY chains
 *      via a binary search over RPC.
 *   2. Calls `balanceOfAt(addr, blockNumber)` per voter per chain — the
 *      truly historical lookup.
 *   3. Sums across chains.
 *   4. Emits a paste-ready entry for the appropriate map below.
 *
 * The result is the SAME numbers the audit displayed at vote close,
 * before any lock activity since. Pasting + deploying restores the
 * original audit.
 *
 * ============================================================================
 * Adding a snapshot for a NEW cycle (per-cycle EB workflow)
 * ============================================================================
 *
 * 1. After vote close (member vote: 5 days after the third Thursday of the
 *    quarter; retro: see `getRetroVoteCloseTimestamp`), run:
 *
 *        npm --prefix ui run snapshot:vmooney -- \
 *            --kind=member --quarter=N --year=YYYY
 *
 * 2. Paste the printed object as a new entry under
 *    MEMBER_VOTE_VMOONEY_SNAPSHOTS or RETRO_VMOONEY_SNAPSHOTS, keyed by
 *    `${year}-Q${quarter}`. Commit the file. From that deploy onward the
 *    audit for that cycle is frozen.
 *
 * 3. The on-chain `vote.ts` POST handler also logs a `--method=projected`
 *    snapshot at close-time as a backup. Always prefer the
 *    `--method=historical` capture when possible — the projected one can
 *    drift if any voter changes their lock between vote close and the
 *    capture.
 *
 * ============================================================================
 * Schema
 * ============================================================================
 *
 *   voteCloseTimestamp  unix seconds — used as the snapshot moment. Must
 *                       match what the compute pipeline derives so audits
 *                       label the snapshot correctly. Stored for reference
 *                       only; lookups use the (quarter, year) key.
 *   snapshotTakenAt     unix seconds — when this entry was captured.
 *                       Useful for diffing against `voteCloseTimestamp`
 *                       to spot late captures.
 *   method              'historical' (balanceOfAt — truly historical) or
 *                       'projected' (balanceOf(addr, _t) — extrapolated
 *                       from the latest user point, only correct if
 *                       captured at the exact moment of vote close).
 *                       Audit-page display is identical either way; this
 *                       is metadata for debuggability.
 *   blockAtClose        per-chain block heights used for the historical
 *                       lookup, so an auditor can independently re-derive
 *                       the same numbers via any explorer / local node.
 *                       Optional; only present on `historical` snapshots.
 *   vMOONEY             { lowercased address → vMOONEY (whole tokens) }.
 *                       Per-voter total summed across all four chains.
 *                       Quadratic voting power is computed downstream as
 *                       √vMOONEY (clamped to 0 on NaN), so we store the
 *                       pre-sqrt value to keep the snapshot interpretable.
 *
 * Addresses are stored lowercased for case-insensitive lookup. Missing
 * voters resolve to 0 vMOONEY (matches the live fetcher's failure mode).
 */

export type VMooneySnapshot = {
  quarter: number
  year: number
  voteCloseTimestamp: number
  snapshotTakenAt: number
  /**
   * Capture method.
   *
   *   'historical' — `balanceOfAt(addr, blockNumber)` against the block
   *                  at vote close on each chain. Truly historical;
   *                  immune to subsequent lock changes.
   *   'projected'  — `balanceOf(addr, voteCloseTimestamp)`. Only correct
   *                  if captured at the exact moment of vote close.
   *                  Acceptable as a backup capture (e.g. from the
   *                  `vote.ts` POST handler at on-chain tally time);
   *                  prefer the historical method when re-running.
   *
   * Optional for backward compat with the original snapshots that
   * predate this field — treat absent as 'projected'.
   */
  method?: 'historical' | 'projected'
  /**
   * Per-chain block heights used for the `balanceOfAt` lookup. Only
   * populated on `method: 'historical'` snapshots so an auditor can
   * independently re-derive the same numbers via any block explorer
   * or a local archive node.
   */
  blockAtClose?: Record<string, number>
  /** Lowercased address → vMOONEY (whole tokens, summed across all chains). */
  vMOONEY: Record<string, number>
}

const cycleKey = (quarter: number, year: number) => `${year}-Q${quarter}`

/**
 * Member Vote (project distribution) cycles. Snapshot at the
 * `voteCloseTimestamp` derived in `computeMemberVoteOutcome` (third
 * Thursday of the quarter + 5 days).
 */
export const MEMBER_VOTE_VMOONEY_SNAPSHOTS: Record<string, VMooneySnapshot> = {
  // Q2 2026 member vote (closed 2026-04-21 07:00:00 UTC). Recovered via
  // `balanceOfAt(addr, blockNumber)` against the block at vote close on
  // each chain — see `blockAtClose` for the exact heights so an auditor
  // can re-derive these numbers from any explorer / archive node.
  // Captured by `snapshot-vmooney.mjs --method=historical` after the
  // audit had drifted from post-vote lock activity; pasting this entry
  // restores the original at-vote-close numbers.
  '2026-Q2': {
    quarter: 2,
    year: 2026,
    voteCloseTimestamp: 1776754800,
    snapshotTakenAt: 1778791147,
    method: 'historical',
    blockAtClose: {
      arbitrum: 454734421,
      ethereum: 24926655,
      polygon: 85817378,
      base: 44982726,
    },
    vMOONEY: {
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 0,
      '0x45142255717c78503d585d50a46e84d63473d4b8': 0,
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 0,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 286193.1284880771,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 0,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 2361115.788305429,
      '0x6dfd4a0a88832d88532167f83f796fbed4752e55': 0,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 0,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 0,
      '0xa64f2228ccec96076c82abb903021c33859082f8': 73958.00109398781,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 18069.294486325136,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 2116337.1746226996,
      '0xb3d7efd33cb72d63a3490c7b03907c05f1897109': 0,
      '0xc0f91468116d88ee2615ef71697a400be7858544': 0,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 38705.813401070394,
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 0,
    },
  },
}

/**
 * Retroactive Rewards cycles. Snapshot at the `voteCloseTimestamp` derived
 * in `computeRetroactiveOutcome` (`getRetroVoteCloseTimestamp`).
 */
export const RETRO_VMOONEY_SNAPSHOTS: Record<string, VMooneySnapshot> = {
  // Every retro cycle below was recovered via `snapshot-vmooney.mjs
  // --method=historical` against the per-chain block at vote close —
  // see each entry's `blockAtClose` for the exact heights so any
  // auditor can re-derive the numbers from any explorer / archive
  // node. Pinning these freezes the audit at the original at-vote-
  // close numbers, so subsequent lock activity can no longer drift
  // past-cycle results.
  '2024-Q2': {
    quarter: 2,
    year: 2024,
    voteCloseTimestamp: 1721088000,
    snapshotTakenAt: 1778791401,
    method: 'historical',
    blockAtClose: {
      arbitrum: 232626499,
      ethereum: 20315347,
      polygon: 59408426,
      base: 17149326,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
    },
  },
  '2024-Q4': {
    quarter: 4,
    year: 2024,
    voteCloseTimestamp: 1737417600,
    snapshotTakenAt: 1778791432,
    method: 'historical',
    blockAtClose: {
      arbitrum: 297564813,
      ethereum: 21669146,
      polygon: 66946419,
      base: 25314126,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
      '0x25910143c255828f623786f46fe9a8941b7983bb': 186568.0449997264,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 441791.3971334348,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 5479424.467275495,
      '0x6bfd9e435cf6194c967094959626ddff4473a836': 491891.20550233225,
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 232653.76795050327,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 58352.08609272629,
    },
  },
  '2025-Q1': {
    quarter: 1,
    year: 2025,
    voteCloseTimestamp: 1745280000,
    snapshotTakenAt: 1778791609,
    method: 'historical',
    blockAtClose: {
      arbitrum: 328850772,
      ethereum: 22320818,
      polygon: 70593580,
      base: 29245326,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 411011.8277524099,
      '0x6bfd9e435cf6194c967094959626ddff4473a836': 449926.24004361534,
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 204964.1721363776,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 0,
      '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': 849943.9450152207,
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 0,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 0,
      '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': 0,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 54423.66116306297,
    },
  },
  '2025-Q2': {
    quarter: 2,
    year: 2025,
    voteCloseTimestamp: 1753142400,
    snapshotTakenAt: 1778791467,
    method: 'historical',
    blockAtClose: {
      arbitrum: 360197470,
      ethereum: 22971002,
      polygon: 74249561,
      base: 33176526,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
      '0x08e424b69851b7b210ba3e5e4233ca6fcc1adedb': 0,
      '0x223da87421786dd8960bf2350e6c499bebca64d1': 5432.025977430528,
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 0,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 0,
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 177321.98004376644,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 0,
      '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': 0,
      '0x9a1741b58bd99ebbc4e9742bd081b887dfc95f53': 0,
      '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': 787668.8308599695,
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 0,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 0,
      '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': 0,
    },
  },
  '2025-Q3': {
    quarter: 3,
    year: 2025,
    voteCloseTimestamp: 1761004800,
    snapshotTakenAt: 1778791503,
    method: 'historical',
    blockAtClose: {
      arbitrum: 391681914,
      ethereum: 23622239,
      polygon: 77950023,
      base: 37107726,
    },
    vMOONEY: {
      '0x04877685e94e0694944d08a43d021e5768b595f0': 0,
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 349086.7302447996,
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 0,
      '0x6bfd9e435cf6194c967094959626ddff4473a836': 365506.35586305335,
      '0x79d0b453dd5d694da4685fbb94798335d5f77760': 0,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 112936.09942033686,
      '0x8a7fd7f4b1a77a606dfdd229c194b1f22de868ff': 0,
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 0,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 0,
      '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': 0,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 46574.420292092575,
      '0xe6d26d4b4785679e029a406c1e85b2a72e2c603b': 0,
    },
  },
  '2025-Q4': {
    quarter: 4,
    year: 2025,
    voteCloseTimestamp: 1768867200,
    snapshotTakenAt: 1778791559,
    method: 'historical',
    blockAtClose: {
      arbitrum: 423161918,
      ethereum: 24272265,
      polygon: 81873614,
      base: 41038926,
    },
    vMOONEY: {
      '0x04877685e94e0694944d08a43d021e5768b595f0': 0,
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
      '0x223da87421786dd8960bf2350e6c499bebca64d1': 4185.399313657386,
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 0,
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 0,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 0,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 2986350.6785895484,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 0,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 0,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 105419.17010461361,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 19453.37696294709,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 2263727.8580856924,
      '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': 0,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 42643.966252542356,
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 0,
    },
  },
  '2026-Q1': {
    quarter: 1,
    year: 2026,
    voteCloseTimestamp: 1776729600,
    snapshotTakenAt: 1778791227,
    method: 'historical',
    blockAtClose: {
      arbitrum: 454635281,
      ethereum: 24924560,
      polygon: 85804778,
      base: 44970126,
    },
    vMOONEY: {
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 0,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 286292.22555175034,
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 0,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 0,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 2363117.4689244037,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 0,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 0,
      '0x977e3f778d1afce209fa0d2299374b1875f5238a': 0,
      '0xa64f2228ccec96076c82abb903021c33859082f8': 74060.08680555555,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 18073.72560671136,
    },
  },
}

export function getMemberVoteVMooneySnapshot(
  quarter: number,
  year: number
): VMooneySnapshot | null {
  return MEMBER_VOTE_VMOONEY_SNAPSHOTS[cycleKey(quarter, year)] ?? null
}

export function getRetroVMooneySnapshot(
  quarter: number,
  year: number
): VMooneySnapshot | null {
  return RETRO_VMOONEY_SNAPSHOTS[cycleKey(quarter, year)] ?? null
}

/**
 * Resolve a list of voter addresses against a snapshot. Returns vMOONEY
 * values in the same order as `addresses`, defaulting any voter missing
 * from the snapshot to 0 (which downstream maps to 0 voting power, the
 * same outcome the live fetcher produces on a chain-read failure).
 *
 * The address comparison is case-insensitive — Tableland sometimes echoes
 * EIP-55 mixed case while the snapshot is normalized to lowercase.
 */
export function resolveSnapshotVMooney(
  snapshot: VMooneySnapshot,
  addresses: string[]
): number[] {
  return addresses.map((address) => {
    const lower = (address || '').toLowerCase()
    const value = snapshot.vMOONEY[lower]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : 0
  })
}
