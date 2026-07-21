// Pure derivations over an AtlasDataset: date parsing, timeline reveal/dim
// state, dataset year range, and Tableland index-row projection. No React /
// three imports so these are unit-testable headlessly and reused by the UI.

import { centroidDirection, vector3ToLatLon } from './geo'
import type {
  AtlasDataset,
  AtlasIndexRow,
  LatLon,
  Milestone,
  Project,
  ProjectType,
  SharedGoal,
} from './types'

// Parse an atlas date ("2027", "2027-09", "2027-09-15") into a fractional year
// suitable for comparison/sorting. Returns null for empty/invalid input.
export function parseAtlasYear(date: string | undefined): number | null {
  if (!date) return null
  const m = date.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/)
  if (!m) return null
  const year = Number(m[1])
  const month = m[2] ? Number(m[2]) : 1
  const day = m[3] ? Number(m[3]) : 1
  // Fractional year so month/day order within a year is preserved.
  return year + (month - 1) / 12 + (day - 1) / 372
}

// Integer year for an atlas date, or null.
export function atlasYear(date: string | undefined): number | null {
  const y = parseAtlasYear(date)
  return y == null ? null : Math.floor(y)
}

function milestoneYears(project: Project): number[] {
  return project.milestones
    .map((m) => parseAtlasYear(m.targetDate))
    .filter((y): y is number => y != null)
}

// Earliest / latest milestone (fractional) year for a project, or null when
// the project has no dated milestones.
export function projectDateRange(
  project: Project
): { earliest: number; latest: number } | null {
  const years = milestoneYears(project)
  if (years.length === 0) return null
  return { earliest: Math.min(...years), latest: Math.max(...years) }
}

// The [min, max] integer year span across every milestone in the dataset,
// with a sensible fallback when the dataset is empty.
export function datasetYearRange(
  dataset: Pick<AtlasDataset, 'projects'>
): { min: number; max: number } {
  const years: number[] = []
  for (const p of dataset.projects) {
    for (const y of milestoneYears(p)) years.push(y)
  }
  if (years.length === 0) {
    const now = new Date().getUTCFullYear()
    return { min: now, max: now + 1 }
  }
  return { min: Math.floor(Math.min(...years)), max: Math.ceil(Math.max(...years)) }
}

export type ProjectTimeStatus =
  | 'future' // not yet revealed at the current year
  | 'planned' // revealed, milestone still ahead / in progress
  | 'achieved' // latest reached milestone is achieved
  | 'delayed' // a reached milestone is flagged delayed
  | 'cancelled' // a reached milestone is cancelled

export type ProjectTimeState = {
  revealed: boolean
  status: ProjectTimeStatus
  // The milestone that best represents the project at the current year.
  activeMilestone?: Milestone
}

// Determine how a project should render at a given (fractional or integer)
// current year: whether it has appeared yet and which status to style it with.
export function projectStateAtYear(
  project: Project,
  currentYear: number
): ProjectTimeState {
  const range = projectDateRange(project)
  if (!range) {
    // Undated project: always present, treated as planned.
    return { revealed: true, status: 'planned' }
  }
  if (currentYear < range.earliest) {
    return { revealed: false, status: 'future' }
  }

  // Among milestones already reached by currentYear, the latest one drives the
  // displayed status; ties fall back to the whole set.
  const reached = project.milestones
    .map((m) => ({ m, y: parseAtlasYear(m.targetDate) }))
    .filter((x): x is { m: Milestone; y: number } => x.y != null && x.y <= currentYear)
    .sort((a, b) => a.y - b.y)

  const active = reached.length ? reached[reached.length - 1].m : undefined

  let status: ProjectTimeStatus = 'planned'
  if (reached.some((x) => x.m.status === 'cancelled')) status = 'cancelled'
  else if (reached.some((x) => x.m.status === 'delayed')) status = 'delayed'
  else if (active?.status === 'achieved') status = 'achieved'
  else status = 'planned'

  return { revealed: true, status, activeMilestone: active }
}

export type AtlasFilter = {
  orgIds?: string[]
  types?: Project['type'][]
  sharedGoalId?: string
}

// Apply legend/filter selections to a project list.
export function filterProjects(
  projects: Project[],
  filter: AtlasFilter
): Project[] {
  return projects.filter((p) => {
    if (filter.orgIds && filter.orgIds.length && !filter.orgIds.includes(p.orgId)) {
      return false
    }
    if (filter.types && filter.types.length && !filter.types.includes(p.type)) {
      return false
    }
    if (filter.sharedGoalId && !p.sharedGoalIds.includes(filter.sharedGoalId)) {
      return false
    }
    return true
  })
}

// Project the full dataset down to lightweight index rows for Tableland.
export function indexRowsFromDataset(
  dataset: AtlasDataset,
  cid: string
): AtlasIndexRow[] {
  return dataset.projects.map((p) => {
    const range = projectDateRange(p)
    return {
      projectId: p.id,
      orgId: p.orgId,
      type: p.type,
      lat: p.location?.lat ?? null,
      lon: p.location?.lon ?? null,
      locationPrecision: p.locationPrecision,
      earliestDate: range
        ? p.milestones
            .map((m) => ({ m, y: parseAtlasYear(m.targetDate) }))
            .filter((x) => x.y != null)
            .sort((a, b) => (a.y as number) - (b.y as number))[0].m.targetDate
        : null,
      latestDate: range
        ? p.milestones
            .map((m) => ({ m, y: parseAtlasYear(m.targetDate) }))
            .filter((x) => x.y != null)
            .sort((a, b) => (b.y as number) - (a.y as number))[0].m.targetDate
        : null,
      cid,
      updatedAt: dataset.updatedAt,
    }
  })
}

// A tech tree: one capability category (landers, surface construction, …),
// its competing projects, and — when one is declared — the shared-goal race
// whose prediction market prices the category. The globe renders ONE generic
// site per tech tree; clicking it opens the race/market view, and picking a
// competitor there swaps in that company's specific model.
export type TechTree = {
  category: ProjectType
  // Member projects with a surface location (drives the site placement).
  projects: Project[]
  // The capability race for this category, if a goal declares one.
  goal?: SharedGoal
  // Where the category's site marker sits: the race's target region when
  // anchored, otherwise the spherical centroid of the member locations.
  location: LatLon
}

// Orbital assets aren't "on the surface" — they keep their own markers and
// never join a surface tech-tree site.
const NON_SURFACE_TYPES: ProjectType[] = ['orbital']

// Group located surface projects into tech trees, one per category present.
// Applies AFTER org/type filtering so legend filters still work.
export function buildTechTrees(
  projects: Project[],
  sharedGoals: SharedGoal[]
): TechTree[] {
  const byCategory = new Map<ProjectType, Project[]>()
  for (const p of projects) {
    if (!p.location || NON_SURFACE_TYPES.includes(p.type)) continue
    if (!byCategory.has(p.type)) byCategory.set(p.type, [])
    byCategory.get(p.type)!.push(p)
  }

  const trees: TechTree[] = []
  byCategory.forEach((members, category) => {
    // Prefer a goal that declares this category as its race; otherwise fall
    // back to any goal that lists one of the members as a competitor (e.g.
    // the ISRU+power goal covers both the isru_plant and power trees).
    const goal =
      sharedGoals.find((g) => g.category === category) ??
      sharedGoals.find((g) =>
        members.some((m) => g.projectIds.includes(m.id))
      )
    // Only trust the goal's anchor when the goal is *this* category's race —
    // a fallback goal borrowed from another category may target a different
    // zone.
    const location =
      (goal?.category === category ? goal.location : undefined) ??
      (() => {
        const dir = centroidDirection(
          members.map((m) => ({ lat: m.location!.lat, lon: m.location!.lon }))
        )
        const ll = vector3ToLatLon(dir)
        return { lat: ll.lat, lon: ll.lon }
      })()
    trees.push({ category, projects: members, goal, location })
  })

  // Stable order for rendering/tests.
  return trees.sort((a, b) => a.category.localeCompare(b.category))
}

// Convenience lookups used across the UI.
export function orgById(dataset: AtlasDataset, id: string) {
  return dataset.organizations.find((o) => o.id === id)
}
export function projectById(dataset: AtlasDataset, id: string) {
  return dataset.projects.find((p) => p.id === id)
}
export function sharedGoalById(dataset: AtlasDataset, id: string) {
  return dataset.sharedGoals.find((g) => g.id === id)
}
