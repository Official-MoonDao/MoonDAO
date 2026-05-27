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
 *   distributions       { lowercased address → { projectId → percent } }.
 *                       OPTIONAL. When present, the compute pipeline reads
 *                       distributions from here instead of querying
 *                       Tableland live, so post-close edits to the
 *                       Tableland row can no longer drift the audit. Use
 *                       it for any closed cycle. Omit for the active
 *                       cycle (where distributions are still being cast)
 *                       — the pipeline will fall back to live Tableland.
 *
 * Addresses are stored lowercased for case-insensitive lookup. Missing
 * voters resolve to 0 vMOONEY (matches the live fetcher's failure mode).
 */

export type VMooneySnapshot = {
  /**
   * Cycle keys for project quarterly votes (`MEMBER_VOTE_VMOONEY_SNAPSHOTS`,
   * `RETRO_VMOONEY_SNAPSHOTS`). Optional because per-proposal Member Vote
   * snapshots (`MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS`) are keyed by `mdp`
   * instead — each Senate-approved proposal has its own close moment so
   * `(quarter, year)` doesn't apply.
   */
  quarter?: number
  year?: number
  /**
   * MDP (Senate-approved proposal id) for per-proposal Member Vote
   * snapshots in `MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS`. Mutually exclusive
   * with `(quarter, year)` in practice — the cycle maps don't set this,
   * the per-MDP map doesn't set quarter/year.
   */
  mdp?: number
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
  /**
   * Frozen per-voter distributions captured at vote close. Lowercased
   * address → projectId → percent (raw, pre-author-strip, pre-
   * normalization — matches what's written to Tableland). When this
   * field is present the compute pipeline reads from here instead of
   * the live Tableland row, so post-close edits can't drift the audit.
   *
   * Optional for backward compat with the pre-distribution snapshots —
   * absent means "fall back to live Tableland" (correct for the
   * currently-active cycle, but past cycles should always pin
   * distributions to be fully drift-proof).
   */
  distributions?: Record<string, Record<string, number>>
}

const cycleKey = (quarter: number, year: number) => `${year}-Q${quarter}`

/**
 * Member Vote (project distribution) cycles. Snapshot at the
 * `voteCloseTimestamp` derived in `computeMemberVoteOutcome` (third
 * Thursday of the quarter + 5 days).
 */
export const MEMBER_VOTE_VMOONEY_SNAPSHOTS: Record<string, VMooneySnapshot> = {
  // Q2 2026 member vote (snapshot moment 2026-04-20 00:00:00 UTC).
  // This is the date displayed on the originally-published audit
  // screenshot ("Snapshot at vote close (4/20/2026)") and matches the
  // governance close-of-cycle moment for the Q2 Member Vote.
  // Recovered via `balanceOfAt(addr, blockNumber)` against the block
  // at this timestamp on each chain — see `blockAtClose`. This is
  // true historical: each value is decayed from the
  // `user_point_history` entry that was current at the per-chain
  // close-block, NOT from the voter's *latest* point as the buggy
  // `balanceOf(addr, _t)` extrapolation does.
  //
  // Arbitrum L1/L2 block-number note: `blockAtClose.arbitrum` stores
  // the Ethereum L1 block at the close timestamp, NOT the Arbitrum
  // L2 block. On Arbitrum, `block.number` returns the L1 block
  // number, and `balanceOfAt(addr, _block)` does
  // `assert _block <= block.number`. Passing the L2 block reverts
  // (silent undercount); the L1 block is what the contract expects.
  // See `scripts/snapshot-vmooney.mjs` for the full rationale and
  // automatic fix-up.
  //
  // These values reproduce the originally-published audit screenshot
  // exactly to 4 decimal places (MDP-240 22.01%, MDP-235 16.68%,
  // MDP-245 10.20%, MDP-237 10.17%). Funded set: MDP-235, MDP-240,
  // MDP-245, MDP-237 — $15,438.84 of the $17,556.75 cap.
  '2026-Q2': {
    quarter: 2,
    year: 2026,
    voteCloseTimestamp: 1776643200,
    snapshotTakenAt: 1778804880,
    method: 'historical',
    blockAtClose: {
      arbitrum: 24917376,
      ethereum: 24917376,
      polygon: 85761578,
      base: 44926926,
    },
    vMOONEY: {
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 605565.9558124368,
      '0x45142255717c78503d585d50a46e84d63473d4b8': 0,
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 506154.1190454854,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 1393088.9183112527,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 223218.76277934402,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 18216506.636293646,
      '0x6dfd4a0a88832d88532167f83f796fbed4752e55': 66502.76406322942,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 56694.366841610245,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 191891.0515700135,
      '0xa64f2228ccec96076c82abb903021c33859082f8': 623766.7573052527,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 698163.6935566304,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 25198767.573873997,
      '0xb3d7efd33cb72d63a3490c7b03907c05f1897109': 6458.517332137164,
      '0xc0f91468116d88ee2615ef71697a400be7858544': 13435.46582514672,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 5070884.457611926,
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 124702.25092672906,
    },
    // Distributions captured from the live `Proposals_42161_157`
    // table. On-chain history (`RunSQL` events on the Tableland
    // registry) confirms no voter recast their distribution between
    // the April 20 snapshot moment and capture time, so the rows are
    // identical to what was on chain at close. Pinning here makes the
    // audit drift-proof against any future row edit (whether through
    // a re-opened submissions window or a manual owner-side write to
    // the Proposals contract).
    distributions: {
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': { '113': 10, '114': 10, '117': 80 },
      '0x45142255717c78503d585d50a46e84d63473d4b8': { '114': 100 },
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': { '113': 0, '114': 0, '117': 0, '119': 0, '122': 0, '123': 0, '126': 0, '127': 0, '130': 100 },
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': { '113': 5, '117': 20, '121': 5, '122': 15, '126': 15, '127': 40 },
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': { '113': 5, '117': 15, '119': 5, '121': 5, '122': 5, '123': 5, '126': 5, '127': 5, '130': 50 },
      '0x679d87d8640e66778c3419d164998e720d7495f6': { '113': 10, '114': 11, '117': 10, '119': 10, '121': 10, '122': 10, '123': 10, '126': 10, '127': 10, '130': 9 },
      '0x6dfd4a0a88832d88532167f83f796fbed4752e55': { '122': 100 },
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': { '113': 55, '117': 20, '130': 25 },
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': { '130': 100 },
      '0xa64f2228ccec96076c82abb903021c33859082f8': { '114': 80, '127': 20 },
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': { '113': 0, '114': 20, '117': 0, '119': 0, '121': 20, '123': 15, '126': 5, '127': 20, '130': 20 },
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': { '113': 10, '114': 5, '117': 25, '119': 25, '122': 15, '123': 11, '126': 0, '127': 9 },
      '0xb3d7efd33cb72d63a3490c7b03907c05f1897109': { '113': 25, '114': 25, '123': 50 },
      '0xc0f91468116d88ee2615ef71697a400be7858544': { '113': 5, '117': 25, '121': 35, '122': 10, '127': 10, '130': 15 },
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': { '117': 10, '122': 90 },
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': { '114': 10, '119': 10, '122': 25, '123': 30, '126': 25 },
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
    snapshotTakenAt: 1778805009,
    method: 'historical',
    blockAtClose: {
      arbitrum: 20315347,
      ethereum: 20315347,
      polygon: 59408426,
      base: 17149326,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 0,
    },
    distributions: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': { '1': 75, '2': 10, '3': 5, '4': 5, '5': 5 },
    },
  },
  '2024-Q4': {
    quarter: 4,
    year: 2024,
    voteCloseTimestamp: 1737417600,
    snapshotTakenAt: 1778805014,
    method: 'historical',
    blockAtClose: {
      arbitrum: 21669146,
      ethereum: 21669146,
      polygon: 66946419,
      base: 25314126,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 379722.63288812776,
      '0x25910143c255828f623786f46fe9a8941b7983bb': 332464.4601015148,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 441791.3971334348,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 7664106.890494198,
      '0x6bfd9e435cf6194c967094959626ddff4473a836': 535691.3190587439,
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 1666655.850916637,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 1017871.8256047126,
    },
    distributions: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': { '1': 80, '2': 20 },
      '0x25910143c255828f623786f46fe9a8941b7983bb': { '1': 50, '2': 50 },
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': { '0': 45, '1': 35, '2': 20 },
      '0x679d87d8640e66778c3419d164998e720d7495f6': { '0': 75, '1': 10, '2': 15 },
      '0x6bfd9e435cf6194c967094959626ddff4473a836': { '0': 50, '1': 38, '2': 12 },
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': { '1': 67, '2': 33 },
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': { '0': 100 },
    },
  },
  '2025-Q1': {
    quarter: 1,
    year: 2025,
    voteCloseTimestamp: 1745280000,
    snapshotTakenAt: 1778805017,
    method: 'historical',
    blockAtClose: {
      arbitrum: 22320818,
      ethereum: 22320818,
      polygon: 70593580,
      base: 29245326,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 1131436.6330696347,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 661188.0674890673,
      '0x6bfd9e435cf6194c967094959626ddff4473a836': 609116.3327139938,
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 2234874.1113681896,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 2159911.4940871825,
      '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': 930646.5342833933,
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 135624.02446917447,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 3153441.9502914334,
      '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': 6249.129088948135,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 2807327.054455786,
    },
    distributions: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': { '3': 25, '5': 35, '6': 10, '7': 10, '8': 20 },
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': { '3': 10, '5': 30, '6': 30, '7': 15, '8': 15 },
      '0x6bfd9e435cf6194c967094959626ddff4473a836': { '3': 30, '5': 40, '6': 20, '7': 5, '8': 5 },
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': { '3': 15, '6': 32, '7': 38, '8': 15 },
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': { '3': 20, '5': 30, '6': 35, '8': 15 },
      '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': { '3': 15, '5': 50, '6': 14, '7': 14, '8': 7 },
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': { '3': 10, '5': 5, '6': 10, '7': 5, '8': 70 },
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': { '3': 20, '5': 50, '6': 10, '7': 20 },
      '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': { '3': 20, '5': 20, '6': 20, '7': 20, '8': 20 },
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': { '3': 20, '5': 20, '6': 20, '7': 20, '8': 20 },
    },
  },
  '2025-Q2': {
    quarter: 2,
    year: 2025,
    voteCloseTimestamp: 1753142400,
    snapshotTakenAt: 1778805019,
    method: 'historical',
    blockAtClose: {
      arbitrum: 22971002,
      ethereum: 22971002,
      polygon: 74249561,
      base: 33176526,
    },
    vMOONEY: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 2468012.5925506856,
      '0x08e424b69851b7b210ba3e5e4233ca6fcc1adedb': 216989.21879132808,
      '0x223da87421786dd8960bf2350e6c499bebca64d1': 55191.244217627616,
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 115850.1374905461,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 282860.6061043148,
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': 2070709.8194663944,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 2012355.8798203082,
      '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': 91017.57771504753,
      '0x9a1741b58bd99ebbc4e9742bd081b887dfc95f53': 212564.82162965566,
      '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': 1411881.0212728295,
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 155588.7802779227,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 16527005.952456605,
      '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': 7245.849981485133,
    },
    distributions: {
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': { '9': 55, '77': 45 },
      '0x08e424b69851b7b210ba3e5e4233ca6fcc1adedb': { '9': 50, '16': 20, '77': 30 },
      '0x223da87421786dd8960bf2350e6c499bebca64d1': { '9': 20, '16': 70, '77': 10 },
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': { '9': 38, '16': 42, '77': 20 },
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': { '9': 5, '16': 20, '77': 75 },
      '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6': { '9': 100 },
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': { '9': 30, '16': 30, '77': 40 },
      '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': { '9': 30, '16': 20, '77': 50 },
      '0x9a1741b58bd99ebbc4e9742bd081b887dfc95f53': { '9': 100, '16': 0, '77': 0 },
      '0x9fdf876a50ea8f95017dcfc7709356887025b5bb': { '9': 75, '16': 0, '77': 25 },
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': { '9': 40, '16': 40, '77': 20 },
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': { '9': 100, '16': 0 },
      '0xc9592be2224dd7a9ed8078ce18e3edc909d55085': { '16': 50, '77': 50 },
    },
  },
  '2025-Q3': {
    quarter: 3,
    year: 2025,
    voteCloseTimestamp: 1761004800,
    snapshotTakenAt: 1778805019,
    method: 'historical',
    blockAtClose: {
      arbitrum: 23622239,
      ethereum: 23622239,
      polygon: 77950023,
      base: 37107726,
    },
    vMOONEY: {
      '0x04877685e94e0694944d08a43d021e5768b595f0': 75606.98703723794,
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 8895322.198335662,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 626920.5928812994,
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 69883.46292802278,
      '0x6bfd9e435cf6194c967094959626ddff4473a836': 1835547.1742082918,
      '0x79d0b453dd5d694da4685fbb94798335d5f77760': 30892.311310711226,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 2506655.8756674305,
      '0x8a7fd7f4b1a77a606dfdd229c194b1f22de868ff': 69268.26598620802,
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 177360.81714465134,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 15750071.60310761,
      '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': 66502.69001290748,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 3350199.3830183847,
      '0xe6d26d4b4785679e029a406c1e85b2a72e2c603b': 4.969184027689303,
    },
    distributions: {
      '0x04877685e94e0694944d08a43d021e5768b595f0': { '13': 25, '15': 25, '78': 25, '81': 25 },
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': { '13': 95, '15': 5 },
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': { '78': 30, '81': 70 },
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': { '13': 50, '15': 5, '81': 45 },
      '0x6bfd9e435cf6194c967094959626ddff4473a836': { '13': 34, '78': 33, '81': 33 },
      '0x79d0b453dd5d694da4685fbb94798335d5f77760': { '13': 10, '15': 10, '78': 30, '81': 50 },
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': { '13': 45, '15': 15, '78': 25, '81': 15 },
      '0x8a7fd7f4b1a77a606dfdd229c194b1f22de868ff': { '13': 45, '15': 15, '78': 30, '81': 10 },
      '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': { '81': 100 },
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': { '13': 100 },
      '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': { '13': 25, '15': 25, '78': 25, '81': 25 },
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': { '13': 42, '15': 42, '81': 16 },
      '0xe6d26d4b4785679e029a406c1e85b2a72e2c603b': { '13': 25, '15': 25, '81': 50 },
    },
  },
  '2025-Q4': {
    quarter: 4,
    year: 2025,
    voteCloseTimestamp: 1768867200,
    snapshotTakenAt: 1778805021,
    method: 'historical',
    blockAtClose: {
      arbitrum: 24272265,
      ethereum: 24272265,
      polygon: 81873614,
      base: 41038926,
    },
    vMOONEY: {
      '0x04877685e94e0694944d08a43d021e5768b595f0': 159677.10804711154,
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': 14387662.048899466,
      '0x223da87421786dd8960bf2350e6c499bebca64d1': 47109.735531688726,
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 70815.23462273544,
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 560251.6879955719,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 242952.95996808953,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 20214821.379105136,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 60646.66974514065,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 113059.04740355971,
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': 2825925.1820893423,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 746429.2157064202,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 27229006.726845585,
      '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': 62270.572837108295,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 3837208.341896418,
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 99103.96255067983,
    },
    distributions: {
      '0x04877685e94e0694944d08a43d021e5768b595f0': { '80': 50, '83': 5, '86': 10, '87': 10, '88': 25 },
      '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89': { '80': 25, '86': 30, '87': 25, '88': 20 },
      '0x223da87421786dd8960bf2350e6c499bebca64d1': { '83': 50, '88': 50 },
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': { '80': 20, '83': 5, '86': 5, '88': 70 },
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': { '80': 20, '83': 35, '86': 5, '87': 40 },
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': { '80': 25, '87': 75 },
      '0x679d87d8640e66778c3419d164998e720d7495f6': { '80': 5, '86': 35, '87': 33, '88': 27 },
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': { '80': 30, '83': 15, '86': 15, '87': 20, '88': 20 },
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': { '80': 10, '83': 30, '87': 30, '88': 30 },
      '0x86c779b3741e83a36a2a236780d436e4ec673af4': { '80': 20, '83': 15, '86': 20, '87': 15, '88': 30 },
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': { '80': 25, '86': 25, '87': 25, '88': 25 },
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': { '80': 15, '86': 25, '87': 20, '88': 40 },
      '0xb87b8c495d3dae468d4351621b69d2ec10e656fe': { '83': 30, '86': 25, '87': 20, '88': 25 },
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': { '80': 15, '83': 15, '86': 15, '87': 15, '88': 40 },
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': { '80': 25, '83': 30, '87': 15, '88': 30 },
    },
  },
  '2026-Q1': {
    quarter: 1,
    year: 2026,
    voteCloseTimestamp: 1776729600,
    snapshotTakenAt: 1778805017,
    method: 'historical',
    blockAtClose: {
      arbitrum: 24924560,
      ethereum: 24924560,
      polygon: 85804778,
      base: 44970126,
    },
    vMOONEY: {
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 505729.5397114281,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 1391661.7179888906,
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 699741.6845437194,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 222999.3310469245,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 18194276.37965966,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 56650.41974485868,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 191730.08681279529,
      '0x977e3f778d1afce209fa0d2299374b1875f5238a': 148923.0814956711,
      '0xa64f2228ccec96076c82abb903021c33859082f8': 622876.6618537284,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 697626.9888941458,
    },
    distributions: {
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': { '83': 50, '84': 50 },
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': { '83': 75, '84': 25 },
      '0x529bd2351476ba114f9d60e71a020a9f0b99f047': { '83': 50, '84': 50 },
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': { '83': 50, '84': 50 },
      '0x679d87d8640e66778c3419d164998e720d7495f6': { '84': 100 },
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': { '83': 40, '84': 60 },
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': { '83': 50, '84': 50 },
      '0x977e3f778d1afce209fa0d2299374b1875f5238a': { '83': 50, '84': 50 },
      '0xa64f2228ccec96076c82abb903021c33859082f8': { '83': 20, '84': 80 },
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': { '84': 100 },
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
 * Per-MDP Member Vote snapshots. Snapshot at the canonical close moment
 * for a Senate-approved proposal: `tempCheckApprovedTimestamp + 5 days`,
 * read from `Proposals.sol` on Arbitrum. Same mechanism as
 * `MEMBER_VOTE_VMOONEY_SNAPSHOTS` — the only difference is the key (an
 * MDP integer instead of a `(quarter, year)` cycle), since each
 * proposal has its own close timestamp.
 *
 * Each entry's `distributions` is in `{ choiceKey → percent }` shape
 * mirroring the live `vote` column on the `NonProjectProposal_*` table
 * (e.g. `{ "1": 100 }` for an all-Yes single-click vote, where the
 * choice keys map to ['Yes', 'No', 'Abstain'] in `VotingModal.tsx`).
 *
 * Capture workflow:
 *
 *   npm --prefix ui run snapshot:vmooney -- \
 *       --kind=memberProposal --mdp=<n>
 *
 * The script reads `tempCheckApprovedTimestamp(mdp)` from
 * `Proposals.sol` on Arbitrum, derives the canonical close moment
 * (+5 days), resolves the per-chain block-at-close, and emits a
 * paste-ready entry keyed by the MDP integer.
 */
export const MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS: Record<number, VMooneySnapshot> = {}

export function getMemberProposalVMooneySnapshot(
  mdp: number
): VMooneySnapshot | null {
  if (!Number.isInteger(mdp) || mdp <= 0) return null
  return MEMBER_PROPOSAL_VMOONEY_SNAPSHOTS[mdp] ?? null
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

/**
 * Returns true when a snapshot has frozen distributions pinned (so the
 * compute pipeline can read distributions from the snapshot instead of
 * Tableland). Cycles that pre-date the distribution-pinning feature
 * still snapshot voting power but not distributions; the pipeline must
 * fall back to live Tableland for those.
 */
export function snapshotHasDistributions(
  snapshot: VMooneySnapshot | null | undefined
): boolean {
  if (!snapshot || !snapshot.distributions) return false
  return Object.keys(snapshot.distributions).length > 0
}

/**
 * Vote row shape returned by `queryTable` for the Proposals_* and
 * DISTRIBUTION_* tables. Mirrors what the compute pipelines already
 * destructure.
 */
type SnapshotVoteRow = {
  address: string
  distribution: Record<string, number>
  quarter: number
  year: number
}

/**
 * Materialize per-voter votes from the snapshot's frozen distributions.
 * Produces rows in the same shape as `queryTable(... Proposals_*)` so
 * the rest of the pipeline can consume them transparently.
 *
 * Voters with no entry in the snapshot are dropped — they didn't vote
 * at the captured close moment, so they shouldn't appear in the tally.
 */
export function resolveSnapshotDistributions(
  snapshot: VMooneySnapshot
): SnapshotVoteRow[] {
  if (!snapshot.distributions) return []
  const rows: SnapshotVoteRow[] = []
  for (const [address, distribution] of Object.entries(snapshot.distributions)) {
    if (!address || !distribution) continue
    rows.push({
      address: address.toLowerCase(),
      distribution: { ...distribution },
      quarter: snapshot.quarter ?? 0,
      year: snapshot.year ?? 0,
    })
  }
  return rows
}

/**
 * Vote row shape returned by `queryTable(... NonProjectProposal_*)` for
 * per-MDP Member Vote snapshots. Distinct from the cycle-keyed
 * `SnapshotVoteRow` above on two axes: the column name is `vote`
 * (matches `DistributionVote` in `lib/tableland/types.ts`) instead of
 * `distribution`, and the cycle key is `MDP` instead of `(quarter,
 * year)`. The compute pipeline's `runQuadraticVoting` already accepts
 * either column name (`if (!dist) dist = d.vote`), so producing the
 * right field here is purely about UI consumers (e.g.
 * `MemberVoteSidebar` reads `v.vote` directly).
 */
type SnapshotMemberProposalVoteRow = {
  address: string
  vote: Record<string, number>
  MDP: number
}

/**
 * Materialize per-voter votes from a per-MDP Member Vote snapshot's
 * frozen distributions. Mirrors `resolveSnapshotDistributions` but
 * emits the `NonProjectProposal_*` shape (`vote` column + `MDP` cycle
 * key) so `MemberVoteSidebar` and the right-rail Voting Results card
 * can consume snapshot rows interchangeably with live Tableland reads.
 */
export function resolveSnapshotMemberProposalVotes(
  snapshot: VMooneySnapshot
): SnapshotMemberProposalVoteRow[] {
  if (!snapshot.distributions) return []
  const rows: SnapshotMemberProposalVoteRow[] = []
  for (const [address, vote] of Object.entries(snapshot.distributions)) {
    if (!address || !vote) continue
    rows.push({
      address: address.toLowerCase(),
      vote: { ...vote },
      MDP: snapshot.mdp ?? 0,
    })
  }
  return rows
}
