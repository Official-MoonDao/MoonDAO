import { GlobeAltIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { declusterDirections, vector3ToLatLon } from '@/lib/lunar-atlas/geo'
import { TIME_STATUS_OPACITY } from '@/lib/lunar-atlas/display'
import {
  atlasYear,
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
import TimelineScrubber from '@/components/lunar-atlas/TimelineScrubber'
import Head from '@/components/layout/Head'

const HOTSPOTS: { label: string; focus: GlobeFocus }[] = [
  { label: 'South Pole', focus: { lat: -89.5, lon: 0, distanceRadii: 1.45 } },
  { label: 'Shackleton', focus: { lat: -89.9, lon: 0, distanceRadii: 1.2 } },
  { label: 'Full Moon', focus: null },
  { label: 'Nearside', focus: { lat: 0, lon: 0, distanceRadii: 1.7 } },
]
// The South Pole is where nearly every real program is headed, so it is the
// page's home view — the full globe stays one click away for context.
const HOME_HOTSPOT = 0

export default function LunarAtlasIndex() {
  const dataset = SEED_ATLAS

  const [focus, setFocus] = useState<GlobeFocus>(HOTSPOTS[HOME_HOTSPOT].focus)
  const [activeHotspot, setActiveHotspot] = useState(HOME_HOTSPOT)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<ProjectType[]>([])

  const yearRange = useMemo(() => datasetYearRange(dataset), [dataset])
  const [year, setYear] = useState(yearRange.max)
  const [playing, setPlaying] = useState(false)

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

  // Shared declustered directions so marker pins, on-surface models, and camera
  // focus all agree on where each project sits.
  const markerDirs = useMemo(
    () =>
      declusterDirections(
        dataset.projects
          .filter((p) => p.location)
          .map((p) => ({ id: p.id, lat: p.location!.lat, lon: p.location!.lon })),
        0.17,
        0.32
      ),
    [dataset.projects]
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

  const filteredProjects = useMemo(
    () =>
      filterProjects(dataset.projects, {
        orgIds: selectedOrgIds.length ? selectedOrgIds : undefined,
        types: selectedTypes.length ? selectedTypes : undefined,
      }),
    [dataset.projects, selectedOrgIds, selectedTypes]
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

  // Capability races: shared goals with a globe anchor render as region-zone
  // rings on the globe and open the race panel.
  const raceGoals = useMemo(
    () => dataset.sharedGoals.filter((g) => g.location),
    [dataset.sharedGoals]
  )
  const selectedGoal: SharedGoal | undefined = selectedGoalId
    ? dataset.sharedGoals.find((g) => g.id === selectedGoalId)
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

  const highDetail = focus != null || selectedProjectId != null

  // Fly in close and centered on the project's (declustered) marker so its
  // on-surface installation fills the view.
  const flyToProject = (project: Project) => {
    if (!project.location) return
    const dir = markerDirs.get(project.id)
    const ll = dir ? vector3ToLatLon(dir) : project.location
    setFocus({ lat: ll.lat, lon: ll.lon, view: 'surface' })
    setActiveHotspot(-1)
  }

  const handleSelectProject = (id: string) => {
    // Re-clicking the already-selected project is a no-op — the camera is
    // there (or on its way); re-triggering the transition just stutters it.
    if (id === selectedProjectId && !selectedGoalId) return
    // One panel at a time: picking a project (including a competitor from the
    // race panel) closes the race view.
    setSelectedGoalId(null)
    setSelectedProjectId(id)
    const p = projectById(dataset, id)
    if (p) flyToProject(p)
  }

  // Opens the race panel and frames its target region from orbit — a zone
  // view, not the cinematic surface pan reserved for single installations.
  const flyToGoalRegion = (goal: SharedGoal) => {
    if (!goal.location) return
    setFocus({
      lat: goal.location.lat,
      lon: goal.location.lon,
      distanceRadii: 1.35,
    })
    setActiveHotspot(-1)
  }

  const handleSelectSharedGoal = (goalId: string) => {
    if (goalId === selectedGoalId) return
    setSelectedProjectId(null)
    setSelectedGoalId(goalId)
    const g = dataset.sharedGoals.find((x) => x.id === goalId)
    if (g) flyToGoalRegion(g)
  }

  // Backing out of a selection returns to the South Pole overview (home),
  // not the full-globe view — that is where the user was working.
  const clearSelection = () => {
    setSelectedProjectId(null)
    setSelectedGoalId(null)
    setFocus(HOTSPOTS[HOME_HOTSPOT].focus)
    setActiveHotspot(HOME_HOTSPOT)
  }

  // Clicking the lunar surface or empty space backs out of whichever panel
  // is open. Without a selection it does nothing — it must not yank the
  // camera away from a hotspot the user chose.
  const handleBackgroundClick = () => {
    if (selectedProjectId || selectedGoalId) clearSelection()
  }

  // Switching region closes any open panel: keeping a selection while flying
  // elsewhere leaves panel, camera, and selection disagreeing. The focus is
  // spread into a fresh object so re-clicking the active hotspot re-frames
  // the camera — that's the "recenter me" gesture after free tumbling.
  const handleHotspot = (focusValue: GlobeFocus, index: number) => {
    setSelectedProjectId(null)
    setSelectedGoalId(null)
    setFocus(focusValue ? { ...focusValue } : null)
    setActiveHotspot(index)
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
        description="A high-fidelity 3D map of humanity's publicly-stated plans for the Moon — real programs from NASA, SpaceX, and Blue Origin, placed and dated."
      />
      <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#03040a]">
        <MoonGlobeLazy
          focus={focus}
          highDetail={highDetail}
          projects={filteredProjects}
          organizations={dataset.organizations}
          selectedProjectId={selectedProjectId}
          hoveredProjectId={hoveredProjectId}
          onSelectProject={handleSelectProject}
          onHoverProject={setHoveredProjectId}
          getProjectStyle={getProjectStyle}
          markerDirs={markerDirs}
          raceGoals={raceGoals}
          onSelectRaceGoal={handleSelectSharedGoal}
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
                A living map of humanity&apos;s publicly-stated plans for the Moon.
                Click a marker to explore a project, its timeline, and sources.
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

          {/* Bottom controls: region drill-in + timeline scrubber */}
          <div className="flex flex-col items-center gap-3 px-4 pb-6">
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
              <MapPinIcon className="ml-1 h-4 w-4 text-white/50" />
              {HOTSPOTS.map((h, i) => (
                <button
                  key={h.label}
                  onClick={() => handleHotspot(h.focus, i)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    activeHotspot === i
                      ? 'bg-cyan-500/30 text-cyan-100'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

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
        {(selectedGoal || selectedProject) && (
          <div className="pointer-events-none absolute inset-x-4 bottom-40 top-auto z-20 h-[55vh] sm:inset-x-auto sm:bottom-40 sm:right-4 sm:top-20 sm:h-auto sm:w-[380px]">
            {selectedGoal ? (
              <SharedGoalPanel
                goal={selectedGoal}
                competitors={goalCompetitors}
                onClose={clearSelection}
                onSelectProject={handleSelectProject}
                onFlyToRegion={() => flyToGoalRegion(selectedGoal)}
              />
            ) : selectedProject ? (
              <ProjectPanel
                project={selectedProject}
                organization={selectedOrg}
                sharedGoals={selectedSharedGoals}
                onClose={clearSelection}
                onFocusRegion={flyToProject}
                onSelectSharedGoal={handleSelectSharedGoal}
              />
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
