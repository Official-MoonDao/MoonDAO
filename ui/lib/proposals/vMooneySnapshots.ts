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
  // Q2 2026 member vote (snapshot moment 2026-05-04 00:00:00 UTC, the
  // governance-canonical close moment per EB direction). The default
  // `getThirdThursdayOfQuarterTimestamp + 5 days` formula in
  // `dates.ts` would put close at 2026-04-21, but that formula treats
  // the *submission* deadline as vote-open. The actual Member Vote
  // ran past the formula's date and the EB designated 2026-05-04 as
  // the canonical close-of-cycle moment for this quarter; we override
  // the formula here so the recovered values and the displayed close
  // date both reflect that decision.
  // Recovered via `balanceOfAt(addr, blockNumber)` against the block
  // at the override timestamp on each chain — see `blockAtClose`.
  // This is true historical: each value is decayed from the
  // `user_point_history` entry that was current at the per-chain
  // close-block, NOT from the voter's *latest* point as the buggy
  // `balanceOf(addr, _t)` extrapolation does.
  '2026-Q2': {
    quarter: 2,
    year: 2026,
    voteCloseTimestamp: 1777852800,
    snapshotTakenAt: 1778800875,
    method: 'historical',
    blockAtClose: {
      arbitrum: 459112764,
      ethereum: 25017913,
      polygon: 86366378,
      base: 45531726,
    },
    vMOONEY: {
      '0x37e6c43ae0341304ff181da55e8d2593f1728c45': 0,
      '0x45142255717c78503d585d50a46e84d63473d4b8': 9945.195015220641,
      '0x47cc4c7fef42187f9f7901838f316b033e92be05': 0,
      '0x4cbf10c36b481d6aff063070e35b4f42e7aad201': 281881.64320142055,
      '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 0,
      '0x679d87d8640e66778c3419d164998e720d7495f6': 2273962.1385083715,
      '0x6dfd4a0a88832d88532167f83f796fbed4752e55': 0,
      '0x78b9faab8fb5de5c7902f0b0cf1d1c17340ce207': 0,
      '0x7f79a7aaf569f350806813d41aeba544cbd017f4': 0,
      '0xa64f2228ccec96076c82abb903021c33859082f8': 69513.16495433789,
      '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da': 17876.36245176939,
      '0xb2d3900807094d4fe47405871b0c8adb58e10d42': 2095791.8784316229,
      '0xb3d7efd33cb72d63a3490c7b03907c05f1897109': 0,
      '0xc0f91468116d88ee2615ef71697a400be7858544': 0,
      '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801': 38156.915816039094,
      '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 0,
    },
    // Distributions captured at the May 4 close. Each row is the
    // post-close state of the voter's `Proposals_42161_157` row,
    // reproducing exactly what Tableland would return today (verified
    // via `scripts/verify-q2-2026-snapshot.mjs`). On-chain history
    // (`RunSQL` events on the Tableland registry) confirms no voter
    // recast their distribution after the close moment, so this is
    // identical to the live Tableland state at capture time. Pinning
    // here makes the audit drift-proof against any future row edit
    // (whether through a re-opened submissions window or a manual
    // owner-side write to the Proposals contract).
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
      quarter: snapshot.quarter,
      year: snapshot.year,
    })
  }
  return rows
}
