import type { MissionFundingMilestone } from 'const/missionMilestones'

export type MilestoneSegment = {
  /** Fill % for the bar toward the current segment end */
  progressPercent: number
  /** USD at the start of this segment (0 before the first milestone) */
  segmentStartUsd: number
  /** USD at the end of this segment (the next milestone to hit) */
  segmentEndUsd: number
  /** Index in sorted milestones for the next target, or null if all passed */
  nextMilestoneIndex: number | null
  allMilestonesComplete: boolean
}

/**
 * Progress within the current “leg”: from the last achieved milestone (or $0)
 * to the next USD milestone. Keeps the bar psychologically achievable at each stage.
 */
export function milestoneSegmentProgress(
  raisedUsd: number,
  milestones: MissionFundingMilestone[]
): MilestoneSegment {
  const sorted = [...milestones].sort((a, b) => a.usd - b.usd)
  if (sorted.length === 0) {
    return {
      progressPercent: 0,
      segmentStartUsd: 0,
      segmentEndUsd: 0,
      nextMilestoneIndex: null,
      allMilestonesComplete: false,
    }
  }

  const nextIdx = sorted.findIndex((m) => raisedUsd < m.usd)

  if (nextIdx === -1) {
    const last = sorted[sorted.length - 1]
    return {
      progressPercent: 100,
      segmentStartUsd: last.usd,
      segmentEndUsd: last.usd,
      nextMilestoneIndex: null,
      allMilestonesComplete: true,
    }
  }

  const segmentStartUsd = nextIdx === 0 ? 0 : sorted[nextIdx - 1].usd
  const segmentEndUsd = sorted[nextIdx].usd
  const span = segmentEndUsd - segmentStartUsd
  const progressPercent =
    span <= 0 ? 100 : Math.min(100, Math.max(0, ((raisedUsd - segmentStartUsd) / span) * 100))

  return {
    progressPercent,
    segmentStartUsd,
    segmentEndUsd,
    nextMilestoneIndex: nextIdx,
    allMilestonesComplete: false,
  }
}

export function formatUsdCompact(usd: number): string {
  if (usd >= 1_000_000) {
    const m = usd / 1_000_000
    return m % 1 === 0 ? `$${m}M` : `$${m.toFixed(1)}M`
  }
  if (usd >= 1_000) {
    const k = usd / 1_000
    return k % 1 === 0 ? `$${k}K` : `$${k.toFixed(0)}K`
  }
  return `$${Math.round(usd).toLocaleString()}`
}
