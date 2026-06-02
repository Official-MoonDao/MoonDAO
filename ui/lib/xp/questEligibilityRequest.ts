/**
 * Builds the request used to *check* (not claim) a quest's eligibility.
 *
 * This MUST be a GET. On every XP proof route a GET only reports eligibility,
 * whereas a POST signs the proof AND relays an on-chain bulk-claim transaction
 * on the user's behalf (see e.g. `pages/api/xp/voting-power-proof.ts` and the
 * `submit*BulkClaimFor` helpers). The claimable-quests *count* runs on every
 * dashboard render, so issuing a POST here would silently auto-claim every
 * eligible quest — and burn relayer gas — without the user ever clicking
 * "Claim". Mirrors the read-only `fetchUserMetric` GET in
 * `components/xp/Quest.tsx`.
 *
 * Kept in its own dependency-free module so it can be unit-tested without
 * pulling in the thirdweb client (which requires env at import time).
 */
export function buildQuestEligibilityRequest(
  route: string,
  user: string,
  accessToken: string
): { url: string; init: RequestInit } {
  return {
    url: `${route}?user=${encodeURIComponent(user)}&accessToken=${encodeURIComponent(
      accessToken
    )}`,
    init: {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
  }
}
