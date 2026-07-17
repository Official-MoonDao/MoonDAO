import { Redis } from '@upstash/redis'
import { PROJECT_CYCLE } from 'const/config'
import type { ProjectCyclePhase } from 'const/config'

/**
 * Live project-cycle phase override.
 *
 * The deploy-time default phase lives in `PROJECT_CYCLE.phase` (const/config).
 * This module layers a runtime override on top of it — backed by the same
 * Upstash Redis store the rate-limiter / geo cache use — so the Executive
 * Branch can advance the cycle (Senate → Member → idle) from the operator
 * panel WITHOUT a redeploy. If the override is missing, expired, or KV is
 * unreachable, callers fall back to the config default, so the site always
 * has a safe, deterministic phase.
 *
 * Only the phase flag is stored here. Per-cycle numbers (budget, retro pool,
 * deadlines) are NOT runtime-overridable — those are deliberate, reviewed
 * edits to `PROJECT_CYCLE` that roll the whole cycle forward at once.
 */

export type { ProjectCyclePhase }

// Ordered phase progression within a single cycle. Advancing past 'idle'
// (into the next cycle's Senate Vote) is intentionally NOT automatic: it
// requires editing PROJECT_CYCLE (new quarter, budget, retro pool), which is
// a reviewed config change rather than a one-click runtime flip.
export const PHASE_ORDER: ProjectCyclePhase[] = ['senate', 'member', 'idle']

export type PhaseFlags = {
  isSenateVote: boolean
  isMemberVote: boolean
  // Retroactive rewards run concurrently with the Member Vote.
  isRewardsCycle: boolean
}

// Single mapping from a phase to the three boolean flags the rest of the app
// reads. Mirrors the derived constants in const/config.ts so the live phase
// and the deploy-time default resolve flags identically.
export function getPhaseFlags(phase: ProjectCyclePhase): PhaseFlags {
  return {
    isSenateVote: phase === 'senate',
    isMemberVote: phase === 'member',
    isRewardsCycle: phase === 'member',
  }
}

// The phase the operator "Advance Phase" button moves to next, or null when
// there's nothing left to advance to within this cycle (i.e. already idle).
export function getNextPhase(
  phase: ProjectCyclePhase
): ProjectCyclePhase | null {
  const idx = PHASE_ORDER.indexOf(phase)
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null
  return PHASE_ORDER[idx + 1]
}

export type LivePhaseOverride = {
  // null → follow the PROJECT_CYCLE.phase default.
  phase: ProjectCyclePhase | null
  setBy?: string
  note?: string
  setAt?: string // ISO timestamp
}

const LIVE_PHASE_KEY = 'moondao:operator:cycle_phase'

let cachedRedis: Redis | null | undefined
function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  cachedRedis = url && token ? new Redis({ url, token }) : null
  return cachedRedis
}

function isProjectCyclePhase(value: unknown): value is ProjectCyclePhase {
  return value === 'senate' || value === 'member' || value === 'idle'
}

/**
 * Read the live phase override. Returns `{ phase: null }` when unset, malformed,
 * or when KV is unreachable — callers must treat null as "use config default".
 */
export async function getLivePhaseOverride(): Promise<LivePhaseOverride> {
  const redis = getRedis()
  if (!redis) return { phase: null }
  try {
    const value = await redis.get<LivePhaseOverride | string | null>(
      LIVE_PHASE_KEY
    )
    if (value == null) return { phase: null }
    const record: any =
      typeof value === 'string' ? JSON.parse(value) : value
    return {
      phase: isProjectCyclePhase(record?.phase) ? record.phase : null,
      setBy: typeof record?.setBy === 'string' ? record.setBy : undefined,
      note: typeof record?.note === 'string' ? record.note : undefined,
      setAt: typeof record?.setAt === 'string' ? record.setAt : undefined,
    }
  } catch (err) {
    console.error('[cyclePhase] getLivePhaseOverride failed:', err)
    return { phase: null }
  }
}

/**
 * Persist a live phase override. Pass `phase: null` to clear it (revert to the
 * config default). Throws if KV is not configured so the operator endpoint can
 * surface a clear error instead of silently no-opping.
 */
export async function setLivePhaseOverride(params: {
  phase: ProjectCyclePhase | null
  setBy?: string
  note?: string
}): Promise<LivePhaseOverride> {
  const redis = getRedis()
  if (!redis) {
    throw new Error(
      'Live phase store is not configured (UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN).'
    )
  }
  if (params.phase === null) {
    await redis.del(LIVE_PHASE_KEY)
    return { phase: null }
  }
  const record: LivePhaseOverride = {
    phase: params.phase,
    setBy: params.setBy,
    note: params.note,
    setAt: new Date().toISOString(),
  }
  await redis.set(LIVE_PHASE_KEY, record)
  return record
}

/**
 * Effective phase = live override (if set) else the PROJECT_CYCLE default.
 * This is the single resolver every read path should use.
 */
export function resolveLivePhase(
  override: LivePhaseOverride | null | undefined
): ProjectCyclePhase {
  return override?.phase ?? PROJECT_CYCLE.phase
}
