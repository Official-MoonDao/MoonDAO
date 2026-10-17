import { blockedMdpsForChain, blockedProjectsForChain } from 'const/whitelist'

function numericId(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Projects pulled from /projects, the home dashboard, citizen Open Votes,
 * project pages, and the Senate tally. `chain` defaults to the app chain so
 * tests can check mainnet without mutating env.
 */
export function isBlockedProject(
  project: { id?: unknown; MDP?: unknown } | null | undefined,
  chain: string | undefined = process.env.NEXT_PUBLIC_CHAIN
): boolean {
  if (!project) return false
  const id = numericId(project.id)
  const mdp = numericId(project.MDP)
  if (id !== null && blockedProjectsForChain(chain).has(id)) return true
  if (mdp !== null && blockedMdpsForChain(chain).has(mdp)) return true
  return false
}
