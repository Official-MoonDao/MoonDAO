/** USD thresholds for “what we unlock” messaging — not on-chain goals. */
export type MissionFundingMilestone = {
  usd: number
  label: string
}

export const MISSION_FUNDING_MILESTONES_USD: Record<number, MissionFundingMilestone[]> = {
  4: [
    { usd: 250_000, label: 'Guaranteed 2nd stratospheric seat' },
  ],
}

/** USD pledged off-chain but counted toward campaign “raised” in the UI (mission id → USD). */
export const MISSION_OFF_CHAIN_COMMITTED_USD: Partial<Record<number, number>> = {
  4: 116_500,
}

export function getMissionOffChainCommittedUsd(missionId: unknown): number {
  if (missionId === undefined || missionId === null) return 0
  const id = Number(missionId)
  if (!Number.isFinite(id)) return 0
  const v = MISSION_OFF_CHAIN_COMMITTED_USD[id]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** First USD milestone = minimum goal shown in UI for that mission (e.g. mission 4 milestone 1). */
export function getMissionMinimumUsdGoal(missionId: unknown): number | undefined {
  if (missionId === undefined || missionId === null) return undefined
  const id = Number(missionId)
  if (!Number.isFinite(id)) return undefined
  const steps = MISSION_FUNDING_MILESTONES_USD[id]
  return steps?.[0]?.usd
}

export const MISSION_MINIMUM_GOAL_TOOLTIP =
  'Our near-term goal is $250,000 — enough to lock in a guaranteed second stratospheric seat so a community member can fly alongside Frank. Nothing raised in the first round has been spent, and refunds are made available if a seat cannot be secured.'

/**
 * Tagline overrides (mission id → tagline). Takes precedence over the on-chain
 * metadata tagline so the mission page can reflect campaign copy that isn't yet
 * reflected on-chain — currently the Frank re-open for mission 4. Remove a
 * mission's entry once its on-chain metadata is updated so the on-chain value
 * (team-editable via the Edit Mission flow) becomes the source of truth again.
 */
export const MISSION_TAGLINE_OVERRIDES: Partial<Record<number, string>> = {
  4: 'The competition is back on. Every dollar from round one is still held — now we’re raising to send a member of our community to space alongside Frank White.',
}

export function getMissionTagline(
  missionId: unknown,
  onChainTagline: string | undefined | null
): string | undefined {
  const id = Number(missionId)
  if (Number.isFinite(id)) {
    const override = MISSION_TAGLINE_OVERRIDES[id]
    if (typeof override === 'string' && override.trim()) return override
  }
  const normalized =
    typeof onChainTagline === 'string' ? onChainTagline.trim() : undefined
  return normalized || undefined
}

/**
 * Description (About tab) HTML overrides (mission id → HTML). Same precedence
 * semantics as {@link MISSION_TAGLINE_OVERRIDES}: takes priority over the
 * on-chain metadata description so the mission "About" section reflects the
 * Frank re-open campaign until the on-chain metadata is refreshed. Remove a
 * mission's entry once its on-chain description is updated. Rendered via
 * dangerouslySetInnerHTML, so this must stay trusted, author-controlled markup.
 */
export const MISSION_DESCRIPTION_OVERRIDES: Partial<Record<number, string>> = {
  4: `
<h2>The competition is back on</h2>
<p>The campaign to send Frank White to space is live again — and the contest to fly alongside him is back on. This isn&#39;t a reset; it&#39;s step two. Nothing from the first raise has been spent: every dollar is still held, and every original backer keeps their place in the story.</p>
<p>After a month of calls with spaceflight providers across three continents and a community vote on where to go next, the answer came back loud and clear: finish what we started.</p>
<h3>What&#39;s new this round</h3>
<ul>
<li><strong>A reachable goal.</strong> Our near-term target is <strong>$250,000</strong> — enough to lock in a guaranteed second seat on a stratospheric flight. Frank&#39;s seat is the floor we&#39;re building on; this milestone is about making good on the original promise: sending a member of our community up with him.</li>
<li><strong>Early backers win.</strong> $OVERVIEW now opens at <strong>500 per ETH</strong>. As we reach milestones, we will reduce the rate of $OVERVIEW contributors get. The earlier you contribute, the more voice you get.</li>
<li><strong>Contributing is effortless.</strong> We rebuilt the flow end to end, including an Apple Pay on-ramp — backing a real spaceflight now takes seconds, whether or not you&#39;ve ever touched crypto.</li>
</ul>
<h3>A flight forty years in the making</h3>
<p>For nearly four decades, Frank White has been the world&#39;s most patient witness to an experience he never had. He interviewed more than fifty astronauts and gave the feeling they described a name: the Overview Effect. He wrote the language the entire industry now speaks — and he has never been to space.</p>
<p>In the first round, supporters raised over <strong>$172,000 from 157 contributions</strong> worldwide, with <strong>$0 spent</strong>. We said from the start that if we couldn&#39;t secure at least one seat for Frank, all funds would be returned. That promise still stands.</p>
<h3>How to fly with Frank</h3>
<p>One community member will fly alongside Frank. Any contribution of <strong>$100 or more</strong> grants free MoonDAO citizenship, which is required to enter. From there it&#39;s merit-based: community backing, an essay on what the Overview Effect means to you, review by a committee of professional and commercial astronauts, and a final community governance vote.</p>
<p>The competition is back on. Frank could be next. Let&#39;s get him there.</p>
`.trim(),
}

export function getMissionDescription(
  missionId: unknown,
  onChainDescription: string | undefined | null
): string {
  const id = Number(missionId)
  if (Number.isFinite(id)) {
    const override = MISSION_DESCRIPTION_OVERRIDES[id]
    if (typeof override === 'string' && override.trim()) return override
  }
  return onChainDescription || ''
}

/**
 * Token symbol overrides for missions where the on-chain ERC20 hasn't been deployed via
 * Juicebox yet but the intended symbol is known (e.g. mission 4 / Overview Flight → OVERVIEW).
 */
export const MISSION_TOKEN_SYMBOL_OVERRIDES: Partial<Record<number, string>> = {
  4: 'OVERVIEW',
}

export function getMissionTokenSymbol(
  missionId: unknown,
  onChainSymbol: string | undefined | null
): string | undefined {
  const normalizedOnChainSymbol =
    typeof onChainSymbol === 'string' ? onChainSymbol.trim() : undefined
  if (normalizedOnChainSymbol) return normalizedOnChainSymbol

  if (missionId === undefined || missionId === null) return undefined
  const id = Number(missionId)
  if (!Number.isFinite(id)) return undefined

  const override = MISSION_TOKEN_SYMBOL_OVERRIDES[id]
  const normalizedOverride =
    typeof override === 'string' ? override.trim() : undefined
  return normalizedOverride || undefined
}
