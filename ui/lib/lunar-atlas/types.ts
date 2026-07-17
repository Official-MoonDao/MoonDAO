// Lunar Atlas data model.
//
// Pure types for the MoonDAO-curated atlas of publicly-stated lunar programs.
// No React / three / DOM imports so this is safe to consume from the engine-free
// data layer, API routes, and Cypress unit specs alike.

// A citation backing a stated goal, milestone, or organization ambition. Every
// piece of atlas content is expected to carry at least one public source.
export type SourceRef = {
  label: string
  url: string
  retrievedAt?: string // ISO date the source was captured, for provenance.
}

export type OrganizationKind =
  | 'agency'
  | 'company'
  | 'international'
  | 'consortium'

export type Organization = {
  id: string
  name: string // e.g. "NASA", "SpaceX", "Blue Origin"
  kind: OrganizationKind
  country?: string
  logoURI?: string // IPFS/public asset
  website?: string
  brandColor?: string // hex, drives markers/legend
  summary: string // stated lunar ambition, 1-3 sentences
  sources: SourceRef[]
}

// Selenographic latitude/longitude in degrees. lat in [-90, 90],
// lon in [-180, 180] (positive east).
export type LatLon = { lat: number; lon: number }

// How precisely a project is located. Drives marker styling + an
// "approximate location" badge.
export type LocationPrecision = 'exact' | 'approximate' | 'region'

export type ProjectType =
  | 'crewed_base'
  | 'habitat'
  | 'lander'
  | 'rover'
  | 'isru_plant'
  | 'power'
  | 'comms_pnt'
  | 'orbital'
  | 'construction'
  | 'other'

// Where a project stands in a DePrize competitor roster. `listed` means
// MoonDAO curators consider it a credible competitor; it does NOT imply the
// organization has agreed to participate. Consent is tracked explicitly so the
// UI can stay honest about who has actually signed on.
export type RosterStatus = 'listed' | 'invited' | 'consented' | 'declined'

export type DatePrecision = 'year' | 'month' | 'day' | 'estimated'

export type MilestoneStatus =
  | 'planned'
  | 'in_progress'
  | 'achieved'
  | 'delayed'
  | 'cancelled'

// A measurable output backing a milestone claim (m² of pad, grams of O₂,
// Wh through lunar night, …). Evidence should be numbers, not adjectives —
// these also feed the simulation layer later.
export type MilestoneMetric = {
  label: string // e.g. "Continuous load-bearing surface"
  value: number
  unit: string // e.g. "m²"
}

export type Milestone = {
  id: string
  title: string // e.g. "Artemis III crewed landing"
  targetDate: string // ISO year ("2027"), year-month ("2027-09"), or full date.
  datePrecision: DatePrecision
  status: MilestoneStatus
  metrics?: MilestoneMetric[]
  sources: SourceRef[]
}

// Normalizes an on-surface GLB so it seats correctly on the globe.
export type ModelTransform = {
  scaleToMeters: number
  rotationEuler?: [number, number, number]
  originOffset?: [number, number, number]
}

export type Project = {
  id: string
  orgId: string // -> Organization.id
  name: string // e.g. "Artemis Base Camp"
  type: ProjectType
  summary: string
  location?: LatLon // omit if truly unplaced
  locationPrecision: LocationPrecision
  regionLabel?: string // e.g. "Lunar south pole", used when approximate/region
  modelURI?: string // optional GLB for on-surface 3D model
  modelTransform?: ModelTransform
  milestones: Milestone[]
  sharedGoalIds: string[] // shared goals this project participates in
  // Present when the project is a competitor in a DePrize-shaped shared goal.
  rosterStatus?: RosterStatus
  sources: SourceRef[]
  visibility: 'public' // v1: all curated content is public
}

export type MarketStatus = 'none' | 'planned' | 'live' | 'resolved'
export type ResolutionAuthority = 'senate' | 'oracle'

// DePrize market link points. Designed now, wired later (M6). In v1 the UI
// renders a stub driven off `status`.
export type SharedGoalMarket = {
  status: MarketStatus
  deprizeQuestionId?: string // CTF condition / question id
  deprizeRegistryId?: string // DePrizeRegistry entry
  resolutionAuthority?: ResolutionAuthority
  // Prize distribution across milestones, as fractions summing to 1
  // (e.g. capability demo 0.3, flight 0.7 — the Frank DePrize structure).
  payoutSplit?: { capability: number; flight: number }
  // Human-readable budget gate, e.g. "flight-demo quote ≤ prize-pool TWAP".
  budgetGate?: string
}

// One entry of a frozen capability spec — what a competitor must demonstrate
// to be eligible to win (the "M1" bar). The full spec is pinned to IPFS via
// `specURI` when the market opens; until then these are draft criteria.
export type CapabilityCriterion = {
  id: string
  statement: string // e.g. "Continuous load-bearing surface from regolith"
  threshold?: string // measurable bar, e.g. "≥ 25 m², ≥ 90% regolith by mass"
  specURI?: string // IPFS/URL of the frozen detailed spec
}

export type SharedGoal = {
  id: string
  title: string // e.g. "First sustained crewed south-pole base"
  description: string
  projectIds: string[] // competing projects/orgs
  // Optional globe anchor for capability races: competitors may be Earth
  // companies with no lunar coordinates, but the race itself often targets a
  // region (e.g. the South Pole construction zone).
  location?: LatLon
  regionLabel?: string
  // Draft/frozen eligibility criteria for DePrize-shaped goals.
  criteria?: CapabilityCriterion[]
  targetWindow?: { from?: string; to?: string }
  market?: SharedGoalMarket
  sources: SourceRef[]
}

export type AtlasDataset = {
  schemaVersion: number
  organizations: Organization[]
  projects: Project[]
  sharedGoals: SharedGoal[]
  updatedAt: string
}

export const ATLAS_SCHEMA_VERSION = 1

// Lightweight row shape for the Tableland index (fast querying). Full detail
// lives in the IPFS-pinned AtlasDataset JSON referenced by `cid`.
export type AtlasIndexRow = {
  projectId: string
  orgId: string
  type: ProjectType
  lat: number | null
  lon: number | null
  locationPrecision: LocationPrecision
  earliestDate: string | null
  latestDate: string | null
  cid: string
  updatedAt: string
}
