import { GlobeAltIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { vector3ToLatLon } from '@/lib/lunar-atlas/geo'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import { TIME_STATUS_OPACITY } from '@/lib/lunar-atlas/display'
import {
  atlasYear,
  buildTechTrees,
  datasetYearRange,
  filterProjects,
  orgById,
  projectById,
  projectStateAtYear,
} from '@/lib/lunar-atlas/selectors'
import type { Project, ProjectType, SharedGoal } from '@/lib/lunar-atlas/types'
import type { GlobeFocus } from '@/components/lunar-atlas/MoonGlobe'
import type { MarkerStyle } from '@/components/lunar-atlas/MarkerLayer'
import Legend from '@/components/lunar-atlas/Legend'
import MoonGlobeLazy from '@/components/lunar-atlas/MoonGlobeLazy'
import ProjectPanel from '@/components/lunar-atlas/ProjectPanel'
import SharedGoalPanel from '@/components/lunar-atlas/SharedGoalPanel'
import TechTreePanel from '@/components/lunar-atlas/TechTreePanel'
import TimelineScrubber from '@/components/lunar-atlas/TimelineScrubber'
import Head from '@/components/layout/Head'

// The scene IS the south pole now — a photorealistic LOLA-derived cap, no full
// globe. The home view is a null focus, which the globe's CameraRig frames with
// its oblique three-quarter DEFAULT_CAM (not a top-down orbit).

// The tech-tree sites are arranged as a compact, zoned settlement rather than
// at their (approximate, heavily-overlapping) real coordinates — so the cap
// reads as one connected moonbase. Offsets are angular (radians) in the pole's
// tangent plane (the pole is -Y): [east/west, north/south]. Layout logic:
// habitat at the hub; landing pads + their construction crews to the east;
// the rover garage out front; ISRU to the west; the reactor set back (safety
// standoff) to the north-west.
const BASE_LAYOUT: Partial<Record<string, [number, number]>> = {
  crewed_base: [0.0, 0.0],
  habitat: [0.0, 0.0],
  lander: [0.03, -0.004],
  construction: [0.026, 0.024],
  rover: [-0.002, 0.03],
  isru_plant: [-0.028, 0.016],
  power: [-0.028, -0.02],
}
// Fallback ring for any category not explicitly zoned above.
const FALLBACK_RING = 0.034

function baseSiteDirections(ids: string[]): Map<string, Vec3> {
  const m = new Map<string, Vec3>()
  let fallbackIdx = 0
  const nUnmapped = ids.filter((id) => !BASE_LAYOUT[id]).length
  ids.forEach((id) => {
    let ox: number
    let oz: number
    const zoned = BASE_LAYOUT[id]
    if (zoned) {
      ;[ox, oz] = zoned
    } else {
      const a = (fallbackIdx / Math.max(nUnmapped, 1)) * Math.PI * 2
      ox = Math.cos(a) * FALLBACK_RING
      oz = Math.sin(a) * FALLBACK_RING
      fallbackIdx++
    }
    const len = Math.hypot(ox, 1, oz)
    m.set(id, [ox / len, -1 / len, oz / len])
  })
  return m
}

export default function LunarAtlasIndex() {
  const dataset = SEED_ATLAS

  const [focus, setFocus] = useState<GlobeFocus>(null)
  // Selection is layered: a tech-tree site (category) opens the race/market
  // view; picking a competitor there selects a project, which swaps the
  // site's generic model for the company-specific one.
  const [selectedTreeCategory, setSelectedTreeCategory] =
    useState<ProjectType | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  // The race/tree a selected competitor was opened from, so the project panel
  // can offer a one-click return to that competitor list.
  const [raceReturn, setRaceReturn] = useState<
    { kind: 'goal' | 'tree'; id: string } | null
  >(null)
  const [hoveredCategory, setHoveredCategory] = useState<ProjectType | null>(
    null
  )
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<ProjectType[]>([])

  const yearRange = useMemo(() => datasetYearRange(dataset), [dataset])
  const [year, setYear] = useState(yearRange.max)
  const [playing, setPlaying] = useState(false)

  // This is a fixed, fullscreen scene — it must never scroll. The shared Layout
  // gives <main> `pt-16` on top of `min-h-screen`, making the document ~4rem
  // taller than the viewport, so a two-finger scroll over the HUD (the globe
  // canvas eats wheel events itself) drifts the whole page. Lock the document
  // scroll while this page is mounted and restore it on unmount.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const histogram = useMemo(() => {
    const counts = new Map<number, number>()
    for (const p of dataset.projects) {
      for (const m of p.milestones) {
        const y = atlasYear(m.targetDate)
        if (y != null) counts.set(y, (counts.get(y) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([y, count]) => ({ year: y, count }))
      .sort((a, b) => a.year - b.year)
  }, [dataset.projects])

  // Auto-advance the year while playing; stop at the end.
  const yearRef = useRef(year)
  yearRef.current = year
  useEffect(() => {
    if (!playing) return
    if (yearRef.current >= yearRange.max) setYear(yearRange.min)
    const id = setInterval(() => {
      const next = yearRef.current + 1
      if (next >= yearRange.max) {
        setYear(yearRange.max)
        setPlaying(false)
      } else {
        setYear(next)
      }
    }, 750)
    return () => clearInterval(id)
  }, [playing, yearRange.min, yearRange.max])

  const filteredProjects = useMemo(
    () =>
      filterProjects(dataset.projects, {
        orgIds: selectedOrgIds.length ? selectedOrgIds : undefined,
        types: selectedTypes.length ? selectedTypes : undefined,
      }),
    [dataset.projects, selectedOrgIds, selectedTypes]
  )

  // One surface site per capability category (post-filter, so legend filters
  // hide whole trees when their members are filtered out).
  const trees = useMemo(
    () => buildTechTrees(filteredProjects, dataset.sharedGoals),
    [filteredProjects, dataset.sharedGoals]
  )

  // Shared site directions so markers, models, and camera focus all agree on
  // where each tech-tree site sits (keyed by category). A zoned base layout
  // clusters the sites into one connected settlement instead of piling them
  // at their overlapping real coordinates.
  const markerDirs = useMemo(
    () => baseSiteDirections(trees.map((t) => t.category)),
    [trees]
  )

  const typesPresent = useMemo(() => {
    const set = new Set<ProjectType>()
    dataset.projects.forEach((p) => set.add(p.type))
    return Array.from(set)
  }, [dataset.projects])

  // Timeline-driven marker styling: future projects ghost, achieved solid,
  // delayed/cancelled flagged. Composes on top of the org/type filter.
  const getProjectStyle = useMemo(
    () =>
      (project: Project): MarkerStyle => {
        const st = projectStateAtYear(project, year)
        return { opacity: TIME_STATUS_OPACITY[st.status], visible: true }
      },
    [year]
  )

  const selectedProject = selectedProjectId
    ? projectById(dataset, selectedProjectId)
    : undefined
  const selectedOrg = selectedProject
    ? orgById(dataset, selectedProject.orgId)
    : undefined
  const selectedSharedGoals = useMemo(
    () =>
      selectedProject
        ? dataset.sharedGoals.filter((g) =>
            selectedProject.sharedGoalIds.includes(g.id)
          )
        : [],
    [dataset.sharedGoals, selectedProject]
  )

  const selectedGoal: SharedGoal | undefined = selectedGoalId
    ? dataset.sharedGoals.find((g) => g.id === selectedGoalId)
    : undefined
  // A tree selection without a race goal renders the plain tech-tree panel —
  // but once a competitor is picked, the project panel takes over even though
  // the site category is kept (so the site stays focused and its model swaps).
  const selectedTree =
    !selectedGoal && !selectedProjectId && selectedTreeCategory
      ? trees.find((t) => t.category === selectedTreeCategory)
      : undefined
  const goalCompetitors = useMemo(
    () =>
      selectedGoal
        ? selectedGoal.projectIds
            .map((pid) => projectById(dataset, pid))
            .filter((p): p is Project => Boolean(p))
            .map((p) => ({ project: p, organization: orgById(dataset, p.orgId) }))
        : [],
    [dataset, selectedGoal]
  )

  // The direction of a category's site marker on the globe.
  const siteDir = (category: ProjectType) => markerDirs.get(category)

  // Fly in close and centered on a site. A competitor's race can span
  // categories (e.g. the "power & ISRU" race lists a power reactor and an
  // ISRU plant), so we frame the site the user is *viewing* — not the
  // competitor's own category site — and swap the model in there.
  const flyToProject = (project: Project, siteCategory?: ProjectType | null) => {
    const cat = siteCategory ?? selectedTreeCategory ?? project.type
    const dir = siteDir(cat)
    const ll = dir ? vector3ToLatLon(dir) : project.location
    if (!ll) return
    setFocus({ lat: ll.lat, lon: ll.lon, view: 'surface' })
  }

  const handleSelectProject = (id: string) => {
    // Re-clicking the already-selected project is a no-op — the camera is
    // there (or on its way); re-triggering the transition just stutters it.
    if (id === selectedProjectId && !selectedGoalId) return
    // Remember where we came from so the project panel can return to the list.
    if (selectedGoalId) setRaceReturn({ kind: 'goal', id: selectedGoalId })
    else if (selectedTreeCategory)
      setRaceReturn({ kind: 'tree', id: selectedTreeCategory })
    else setRaceReturn(null)
    // Keep the currently-viewed site focused: the competitor's model swaps in
    // *there*, so picking a competitor never teleports to a different site.
    const site =
      selectedTreeCategory ??
      (selectedGoalId
        ? dataset.sharedGoals.find((g) => g.id === selectedGoalId)?.category
        : undefined) ??
      projectById(dataset, id)?.type ??
      null
    setSelectedGoalId(null)
    setSelectedTreeCategory(site)
    setSelectedProjectId(id)
    const p = projectById(dataset, id)
    if (p) flyToProject(p, site)
  }

  // Return from a competitor's project panel to the race/tree list it was
  // opened from.
  const handleBackToRace = () => {
    const r = raceReturn
    setRaceReturn(null)
    if (!r) return
    if (r.kind === 'goal') handleSelectSharedGoal(r.id)
    else handleSelectTree(r.id as ProjectType)
  }

  // Frames a tech-tree site with the three-quarter "hero" surface view so the
  // leading company's asset is legible from a flattering angle — not the
  // top-down birdseye a straight drill-in gives.
  const flyToSite = (category: ProjectType) => {
    const dir = siteDir(category)
    if (!dir) return
    const ll = vector3ToLatLon(dir)
    setFocus({ lat: ll.lat, lon: ll.lon, view: 'surface' })
  }

  // Clicking a site opens its tech tree: the prediction-market race view when
  // one is declared, otherwise the plain category listing.
  const handleSelectTree = (category: ProjectType) => {
    if (category === selectedTreeCategory && !selectedProjectId) return
    const tree = trees.find((t) => t.category === category)
    if (!tree) return
    setSelectedProjectId(null)
    setSelectedGoalId(tree.goal?.id ?? null)
    setSelectedTreeCategory(category)
    flyToSite(category)
  }

  // Opening a goal directly (from a ProjectPanel link or a race zone ring)
  // also highlights its category's site when it has one.
  const handleSelectSharedGoal = (goalId: string) => {
    if (goalId === selectedGoalId && !selectedProjectId) return
    const g = dataset.sharedGoals.find((x) => x.id === goalId)
    setSelectedProjectId(null)
    setSelectedGoalId(goalId)
    setSelectedTreeCategory(g?.category ?? null)
    if (g?.category && siteDir(g.category)) {
      flyToSite(g.category)
    } else if (g?.location) {
      setFocus({
        lat: g.location.lat,
        lon: g.location.lon,
        distanceRadii: 0.045,
      })
    }
  }

  // Backing out of a selection returns to the South Pole overview (home),
  // not the full-globe view — that is where the user was working.
  const clearSelection = () => {
    setSelectedProjectId(null)
    setSelectedGoalId(null)
    setSelectedTreeCategory(null)
    setRaceReturn(null)
    setFocus(null)
  }

  // Clicking the lunar surface or empty space backs out of whichever panel
  // is open. Without a selection it does nothing — it must not yank the
  // camera away from a hotspot the user chose.
  const handleBackgroundClick = () => {
    if (selectedProjectId || selectedGoalId || selectedTreeCategory)
      clearSelection()
  }

  const toggleOrg = (id: string) =>
    setSelectedOrgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  const toggleType = (t: ProjectType) =>
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  const clearFilters = () => {
    setSelectedOrgIds([])
    setSelectedTypes([])
  }

  return (
    <>
      <Head
        title="Lunar Atlas"
        description="A photorealistic 3D map of the lunar south pole — humanity's publicly-stated plans from NASA, SpaceX, and Blue Origin, placed on real LOLA terrain."
      />
      <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#03040a]">
        <MoonGlobeLazy
          focus={focus}
          trees={trees}
          organizations={dataset.organizations}
          selectedTreeCategory={selectedTreeCategory}
          selectedProject={selectedProject ?? null}
          hoveredCategory={hoveredCategory}
          onSelectTree={handleSelectTree}
          onHoverTree={setHoveredCategory}
          getProjectStyle={getProjectStyle}
          markerDirs={markerDirs}
          onBackgroundClick={handleBackgroundClick}
        />

        {/* Overlay HUD */}
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 p-4 sm:p-6">
            <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="h-5 w-5 text-cyan-300" />
                <h1 className="text-lg font-semibold text-white">Lunar Atlas</h1>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                The lunar south pole, built from NASA LOLA terrain data —
                where every serious program is headed. Click a site to explore
                its capability race, competitors, and sources.
              </p>
            </div>

            <Legend
              organizations={dataset.organizations}
              typesPresent={typesPresent}
              selectedOrgIds={selectedOrgIds}
              selectedTypes={selectedTypes}
              onToggleOrg={toggleOrg}
              onToggleType={toggleType}
              onClear={clearFilters}
              projects={dataset.projects}
            />
          </div>

          {/* Middle spacer keeps the bottom controls pinned down. */}
          <div className="min-h-0 flex-1" />

          {/* Bottom controls: timeline scrubber */}
          <div className="flex flex-col items-center gap-3 px-4 pb-6">
            <TimelineScrubber
              minYear={yearRange.min}
              maxYear={yearRange.max}
              year={year}
              onChange={(y) => {
                setYear(y)
                setPlaying(false)
              }}
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
              histogram={histogram}
            />
          </div>
        </div>

        {/* Detail panel: right dock on desktop, bottom sheet on mobile.
            Positioned absolutely (not in the HUD flex column) so its height
            doesn't depend on how tall the Legend happens to be; it overlays
            the Legend while open. One panel at a time — race view wins. */}
        {(selectedGoal || selectedTree || selectedProject) && (
          <div className="pointer-events-none absolute inset-x-4 bottom-40 top-auto z-20 h-[55vh] sm:inset-x-auto sm:bottom-40 sm:right-4 sm:top-20 sm:h-auto sm:w-[380px]">
            {selectedGoal ? (
              <SharedGoalPanel
                goal={selectedGoal}
                competitors={goalCompetitors}
                onClose={clearSelection}
                onSelectProject={handleSelectProject}
              />
            ) : selectedTree ? (
              <TechTreePanel
                tree={selectedTree}
                organizations={dataset.organizations}
                onClose={clearSelection}
                onSelectProject={handleSelectProject}
              />
            ) : selectedProject ? (
              <ProjectPanel
                project={selectedProject}
                organization={selectedOrg}
                sharedGoals={selectedSharedGoals}
                onClose={clearSelection}
                onFocusRegion={flyToProject}
                onSelectSharedGoal={handleSelectSharedGoal}
                onBack={raceReturn ? handleBackToRace : undefined}
              />
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
