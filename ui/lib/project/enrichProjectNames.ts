import {
  getProjectDisplayName,
  isUntitledLike,
  UNTITLED_FALLBACK,
} from '@/lib/project/getProjectDisplayName'

/**
 * Server-side utility: for any project whose stored `name` is empty or
 * "Untitled", fetch its IPFS proposal JSON and resolve the real title via
 * `getProjectDisplayName`. Mutates each project's `name` in-place.
 *
 * Failures are silently swallowed — the client-side `useProposalJSON` hook
 * in `ProjectCard` remains as a fallback.
 */
export async function enrichProjectNames(projects: any[]): Promise<void> {
  const untitled = projects.filter(
    (p) => isUntitledLike(p.name) && !!p.proposalIPFS
  )
  if (untitled.length === 0) return

  await Promise.allSettled(
    untitled.map(async (project) => {
      try {
        const res = await fetch(project.proposalIPFS)
        const json = await res.json()
        const resolved = getProjectDisplayName(project, json)
        if (resolved !== UNTITLED_FALLBACK) project.name = resolved
      } catch {
        // leave as-is
      }
    })
  )
}
