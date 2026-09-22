import {
  getDePrizeCompetition,
  getDePrizeRaceBinding,
} from '@/lib/deprize/competitions'
import { SEED_ATLAS, orgById, projectById } from '@/lib/lunar-atlas'

export function deprizeOutcomeLabels(chainSlug: string, deprizeId: number): string[] {
  const binding = getDePrizeRaceBinding(chainSlug, deprizeId)
  if (binding?.outcomes?.length) {
    return binding.outcomes.map((outcome, i) => {
      if (outcome.field) return 'Open Field'
      if (outcome.projectId) {
        const project = projectById(SEED_ATLAS, outcome.projectId)
        const org = project ? orgById(SEED_ATLAS, project.orgId) : undefined
        return org?.name || project?.name || `Team #${i + 1}`
      }
      return `Team #${i + 1}`
    })
  }
  const competition = getDePrizeCompetition(chainSlug, deprizeId)
  if (competition.title) return [competition.title]
  return ['Team #1', 'Team #2']
}
