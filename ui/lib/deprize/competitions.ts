/**
 * Per-competition copy + CTF questionId registry.
 *
 * Production admin/detail pages look up here instead of the global
 * DEPRIZE_QUESTION_ID / ORACLE_ADDRESS scalars (those stay for the
 * deprize-play harness only). Tech-tree prizes seed new entries here
 * until questionId moves on-chain.
 *
 * Seeding `questionId` is what lets the admin panel derive the oracle role
 * (keccak(caller, questionId, numOutcomes) == the market's conditionId). An
 * oracle that is neither registry owner nor fee-router owner cannot unlock the
 * panel without an entry here — resolve via Safe + DePrizeResolve.s.sol until
 * the competition is registered.
 */

export type DePrizeCompetition = {
  /** <Head> title + optional page title suffix. */
  title: string
  /** Header paragraph under the DePrize #{id} title. */
  tagline: string
  /** <Head> meta description. */
  metaDescription: string
  /** CTF questionId used at prepareCondition (needed by reportPayouts). */
  questionId?: string
}

export const GENERIC_DEPRIZE_COMPETITION: DePrizeCompetition = {
  title: 'DePrize',
  tagline:
    'Back the team you think will win — live odds, payout when a winner is declared.',
  metaDescription:
    'Back the team you think will win — live odds, payout when a winner is declared.',
}

/** chainSlug → deprizeId → competition */
const DEPRIZE_COMPETITIONS: Record<string, Record<number, DePrizeCompetition>> = {
  sepolia: {
    // Browser QA fixture — see docs/DEPRIZE_QA.md (DePrize 9).
    // Oracle at prepareCondition = deployer 0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011.
    9: {
      title: 'Sepolia QA fixture',
      tagline:
        'Sepolia browser QA subject — three Team NFTs, live LMSR odds, FeeRouter-owned market.',
      metaDescription:
        'Sepolia DePrize QA fixture with live odds. Back a team and cash out or claim when resolved.',
      questionId:
        '0xab937cdea2250786bf37ee2dd06f244bbeed62159c337927074523844d5759fb',
    },
  },
}

/** True when this (chain, id) has an explicit registry entry. */
export function isKnownDePrizeCompetition(
  chainSlug: string,
  deprizeId: number | undefined
): boolean {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return false
  return !!DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId]
}

/** Competition copy for a DePrize; falls back to generic copy when unregistered. */
export function getDePrizeCompetition(
  chainSlug: string,
  deprizeId: number | undefined
): DePrizeCompetition {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) {
    return GENERIC_DEPRIZE_COMPETITION
  }
  return DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId] ?? GENERIC_DEPRIZE_COMPETITION
}

/** CTF questionId for a DePrize, or undefined when not registered. */
export function getDePrizeQuestionId(
  chainSlug: string,
  deprizeId: number | undefined
): string | undefined {
  if (deprizeId === undefined || !Number.isFinite(deprizeId)) return undefined
  return DEPRIZE_COMPETITIONS[chainSlug]?.[deprizeId]?.questionId
}
