// Jobs and marketplace listings record their owner in a `teamId` column.
// Projects are stored in that same column shifted by this offset so a project
// can never be mistaken for the team with the same token id. Changing it orphans
// every project row already written.
export const PROJECT_ID_OFFSET = 1_000_000

export type OwnerKind = 'team' | 'project'

export type OwnerRef = {
  kind: OwnerKind
  /** Token id on the Team contract or the Project contract. */
  id: number
}

export function toProjectOwnerId(projectId: number | string | bigint): number {
  return PROJECT_ID_OFFSET + Number(projectId)
}

export function isProjectOwnerId(teamId: number | string | bigint | null | undefined): boolean {
  if (teamId === null || teamId === undefined || teamId === '') return false
  return Number(teamId) >= PROJECT_ID_OFFSET
}

export function parseOwnerId(teamId: number | string | bigint): OwnerRef {
  const value = Number(teamId)
  return value >= PROJECT_ID_OFFSET
    ? { kind: 'project', id: value - PROJECT_ID_OFFSET }
    : { kind: 'team', id: value }
}

/**
 * `/project/[tokenId]` resolves MDP before project id, so a project must be
 * linked by its MDP or the link can land on a different project.
 */
export function projectHref(mdp: number | string | null | undefined): string {
  return mdp === null || mdp === undefined || mdp === '' ? '/projects' : `/project/${mdp}`
}

/** Profile link for a `teamId` column value. */
export function ownerHref(
  teamId: number | string | bigint,
  { teamSlug, projectMDP }: { teamSlug?: string; projectMDP?: number | string | null } = {}
): string {
  const owner = parseOwnerId(teamId)
  if (owner.kind === 'project') return projectHref(projectMDP)
  return `/team/${teamSlug || owner.id}`
}

export function ownerFallbackName(teamId: number | string | bigint): string {
  const owner = parseOwnerId(teamId)
  return owner.kind === 'project' ? `Project ${owner.id}` : `Team ${owner.id}`
}
