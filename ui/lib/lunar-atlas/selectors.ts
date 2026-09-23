// Pure derivations over an AtlasDataset: date parsing, timeline reveal/dim
// state, dataset year range, and Tableland index-row projection. No React /
// three imports so these are unit-testable headlessly and reused by the UI.

import { centroidDirection, vector3ToLatLon } from './geo'
import type {
  AtlasDataset,
  AtlasIndexRow,
  LatLon,
  MarketStatus,
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

// True for a milestone that represents hardware actually AT the Moon (landed,
// delivered, operating on the surface or in cislunar orbit) rather than an
// Earth-side step on the way there (contract award, concept publication,
// ground/vacuum-chamber test). Undefined defaults to 'moon' so most milestone
// entries — landings, surface demos, deliveries — don't need to say so.
export function isMoonMilestone(m: Milestone): boolean {
  return m.location !== 'earth'
}

// The real-world year. The scrubber's past is history and its future is
// forecast, and the boundary between the two moves, so it has to be read off
// the clock rather than baked into the dataset. Every function below takes it
// as an argument so tests can pin it and not rot as the year turns over.
export function atlasNowYear(): number {
  return new Date().getUTCFullYear()
}

// The scrubber year at which a Moon milestone actually puts hardware on the
// Moon, or null when it never does. Three cases:
//
//   - Achieved: it happened, so it counts from the year it happened.
//   - Cancelled: it delivered nothing. A hard landing leaves debris on the
//     Moon, not a lander, and scrubbing past it must not stand the vehicle up
//     on the surface.
//   - Still only planned (or delayed, or in progress on Earth): a promise. A
//     target date that has already come and gone without being marked achieved
//     is a slip, not an arrival — so it counts no earlier than the first year
//     still ahead of us. This is what stops the scrubber claiming a 2026
//     landing is on the ground in 2026 when it has not flown.
export function milestoneArrivalYear(
  m: Milestone,
  nowYear: number
): number | null {
  if (!isMoonMilestone(m)) return null
  const y = parseAtlasYear(m.targetDate)
  if (y == null) return null
  if (m.status === 'cancelled') return null
  if (m.status === 'achieved') return y
  return Math.max(y, nowYear + 1)
}

// Has this milestone's hardware arrived by scrubber year `at`? Integer scrubber
// years cover the whole calendar year, so a "2025-06" milestone counts as
// reached at scrubber year 2025; a fractional `at` keeps month ordering.
function arrivedBy(m: Milestone, at: number, nowYear: number): boolean {
  const y = milestoneArrivalYear(m, nowYear)
  if (y == null) return false
  return (Number.isInteger(at) ? Math.floor(y) : y) <= at
}

// The race a project is entered in: the goal that declares its category, or
// failing that the first goal that lists it at all.
function raceForProject(
  project: Project,
  goals: SharedGoal[]
): SharedGoal | undefined {
  const entered = goals.filter((g) => g.projectIds.includes(project.id))
  return entered.find((g) => g.category === project.type) ?? entered[0]
}

// Where to put a competitor that has no Moon date of its own on the timeline.
//
// Plenty of real, funded hardware has no announced flight date — most of the
// regolith-construction and ISRU field is in that position, holding NASA
// contracts with no manifested lunar demo. Showing it in every year (which is
// what this code used to do) claims it is on the Moon today; showing it in no
// year at all deletes a whole race from the base. Neither is true.
//
// Its race is the honest answer: each capability race carries a sourced
// targetWindow, and an undated entrant is taken to arrive by the far end of
// that window — the latest the race itself expects to be settled. So the
// landing-pad field turns up together at 2032 rather than in 2023 or never.
// Give a project its own dated milestone and that always wins over this.
export function raceArrivalYear(
  project: Project,
  goals: SharedGoal[],
  nowYear: number
): number | null {
  const window = raceForProject(project, goals)?.targetWindow
  const y = parseAtlasYear(window?.to ?? window?.from)
  return y == null ? null : Math.max(y, nowYear + 1)
}

// Years this project is on the Moon: its own arrivals when it has any, and
// otherwise the year its race expects it by. Empty when neither exists.
function arrivalYears(
  project: Project,
  nowYear: number,
  raceYear?: number | null
): number[] {
  const own = project.milestones
    .map((m) => milestoneArrivalYear(m, nowYear))
    .filter((y): y is number => y != null)
  if (own.length > 0) return own
  return raceYear == null ? [] : [Math.max(raceYear, nowYear + 1)]
}

// First / last (fractional) year this project has hardware on the Moon, or null
// when it never does on the current data — nothing but failed attempts, or no
// date at all and no race window to fall back on.
export function projectDateRange(
  project: Project,
  nowYear: number = atlasNowYear(),
  raceYear?: number | null
): { earliest: number; latest: number } | null {
  const years = arrivalYears(project, nowYear, raceYear)
  if (years.length === 0) return null
  return { earliest: Math.min(...years), latest: Math.max(...years) }
}

// The [min, max] integer year span the scrubber should cover.
//
// The left edge is today. Everything on the Moon right now got there in the
// last couple of years, so the years before today hold at most a lander or two
// and no two of them differ — scrubbing them travelled two years to watch
// nothing change. Today is also the one edge that means something on a scrubber
// whose whole point is the future: left of it there is nothing to see, and
// right of it is the entire base being built.
//
// Landings that already happened are not lost by this; they are on the Moon at
// every year in the window, including its first. What is dropped is the ability
// to ask "what was on the Moon in 2024", which the milestone list on each
// project answers better than a globe on which those craft are three specks.
//
// The right edge is the last arrival anything is expected to make.
export function datasetYearRange(
  dataset: Pick<AtlasDataset, 'projects'> &
    Partial<Pick<AtlasDataset, 'sharedGoals'>>,
  nowYear: number = atlasNowYear()
): { min: number; max: number } {
  const goals = dataset.sharedGoals ?? []
  const years: number[] = []
  for (const p of dataset.projects) {
    years.push(
      ...arrivalYears(p, nowYear, raceArrivalYear(p, goals, nowYear))
    )
  }
  if (years.length === 0) return { min: nowYear, max: nowYear + 1 }
  const min = Math.max(nowYear, Math.floor(Math.min(...years)))
  // Never collapse to a single year: a dataset whose last arrival is already
  // behind us would otherwise hand the scrubber an empty range to divide by.
  return { min, max: Math.max(min + 1, Math.ceil(Math.max(...years))) }
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
  currentYear: number,
  nowYear: number = atlasNowYear(),
  raceYear?: number | null
): ProjectTimeState {
  const moon = project.milestones.filter(isMoonMilestone)

  // Presence on the surface is earned by arrival and nothing else. A project
  // whose only attempts failed has nothing standing there, however much
  // Earth-side work is behind it — it stays a ghost until it has a date it can
  // keep.
  const arrived = moon.filter((m) => arrivedBy(m, currentYear, nowYear))
  if (arrived.length === 0) {
    // No arrival of its own. If it has no Moon date whatsoever, its race window
    // stands in for one (see raceArrivalYear) and it turns up with the rest of
    // the field — as a plan, since there is no milestone to have achieved.
    const [fallback] = arrivalYears(project, nowYear, raceYear)
    const dated = moon.some((m) => parseAtlasYear(m.targetDate) != null)
    if (!dated && fallback != null && Math.floor(fallback) <= currentYear) {
      return { revealed: true, status: 'planned' }
    }
    return { revealed: false, status: 'future' }
  }

  // The headline for the project at this year is the most recent Moon milestone
  // the year has passed, whether or not it delivered — a cancelled follow-on to
  // hardware that did arrive is the honest thing to show. Cancellations are
  // ordered on their own date, since they have no arrival year.
  const passed = moon
    .map((m) => ({
      m,
      y: milestoneArrivalYear(m, nowYear) ?? parseAtlasYear(m.targetDate),
    }))
    .filter((x): x is { m: Milestone; y: number } => {
      if (x.y == null) return false
      return (Number.isInteger(currentYear) ? Math.floor(x.y) : x.y) <=
        currentYear
    })
    .sort((a, b) => a.y - b.y)

  const active = passed[passed.length - 1].m

  let status: ProjectTimeStatus = 'planned'
  if (active.status === 'achieved') status = 'achieved'
  else if (active.status === 'cancelled') status = 'cancelled'
  else if (active.status === 'delayed') status = 'delayed'

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

export type RaceStanding = {
  goalId: string
  title: string
  place: number
  fieldSize: number
  probability: number
  marketStatus?: MarketStatus
}

/** Place + implied odds for a competitor in one shared goal, if priced. */
export function raceStandingForProject(
  projectId: string,
  goal: SharedGoal
): RaceStanding | undefined {
  if (!goal.projectIds.includes(projectId)) return undefined
  const odds = goal.market?.impliedOdds
  const probability = odds?.[projectId]
  if (probability == null || !Number.isFinite(probability)) return undefined
  const ranked = [...goal.projectIds].sort((a, b) => {
    const pa = odds?.[a]
    const pb = odds?.[b]
    const na = pa != null && Number.isFinite(pa) ? pa : -1
    const nb = pb != null && Number.isFinite(pb) ? pb : -1
    if (nb !== na) return nb - na
    return goal.projectIds.indexOf(a) - goal.projectIds.indexOf(b)
  })
  return {
    goalId: goal.id,
    title: goal.title,
    place: ranked.indexOf(projectId) + 1,
    fieldSize: goal.projectIds.length,
    probability,
    marketStatus: goal.market?.status,
  }
}
