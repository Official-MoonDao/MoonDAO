import { GlobeAltIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { mergeLiveMarketInto } from '@/lib/deprize/goal-market'
import { useDePrizeGoalOdds } from '@/lib/deprize/useDePrizeGoalOdds'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import {
  latLonToVector3,
  MOON_RADIUS_M,
  vector3ToLatLon,
} from '@/lib/lunar-atlas/geo'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import { capOffsetLatLon } from '@/lib/lunar-atlas/southpole'
import {
  BASE_PLAN,
  FALLBACK_RING_M,
  districtSlots,
  type Slot,
} from '@/lib/lunar-atlas/baseplan'
import {
  PROJECT_TYPE_LABEL,
  TIME_STATUS_OPACITY,
  orgColor,
} from '@/lib/lunar-atlas/display'
import { SKY_STATIONS, stationLatLon } from '@/lib/lunar-atlas/skyplan'
import {
  atlasYear,
  buildTechTrees,
  datasetYearRange,
  filterProjects,
  orgById,
  projectById,
  projectStateAtYear,
  sharedGoalById,
  type TechTree,
} from '@/lib/lunar-atlas/selectors'
import type { Project, ProjectType, SharedGoal } from '@/lib/lunar-atlas/types'
import type { GlobeFocus } from '@/components/lunar-atlas/MoonGlobe'
import type {
  ColonyLayout,
  MarkerStyle,
} from '@/components/lunar-atlas/MarkerLayer'
import { footprintRadiusM } from '@/components/lunar-atlas/ProjectModel'
import { rankedMembers } from '@/components/lunar-atlas/MarkerLayer'
import Legend, { type RaceEntry } from '@/components/lunar-atlas/Legend'
import MoonGlobeLazy from '@/components/lunar-atlas/MoonGlobeLazy'
import ProjectPanel from '@/components/lunar-atlas/ProjectPanel'
import SharedGoalPanel from '@/components/lunar-atlas/SharedGoalPanel'
import TechTreePanel from '@/components/lunar-atlas/TechTreePanel'
import TimelineScrubber from '@/components/lunar-atlas/TimelineScrubber'
import Head from '@/components/layout/Head'

// The scene IS the Shackleton connecting ridge now — a single photorealistic
// 16x16 km LOLA-derived patch, no full globe. The home view is a null focus,
// which the globe's CameraRig frames with its oblique three-quarter
// DEFAULT_CAM (not a top-down orbit).

// A surface direction from an offset in meters on the ridge patch.
function dirAt(eastM: number, northM: number): Vec3 {
  const ll = capOffsetLatLon(eastM, northM)
  return latLonToVector3(ll.lat, ll.lon, 1)
}

// Where every competitor stands, and where every district's pin goes.
//
// Built here, once, and handed to the globe: the models, the beacons, the road
// network and the camera all read the same table, which is the only way they can
// agree on where a thing is. Plot positions come from the shared plan in
// lib/lunar-atlas/baseplan; the footprint radii it packs against come from the
// model layer, since only it knows how much ground an asset covers.
function buildColonyLayout(trees: TechTree[]): ColonyLayout {
  const districts = new Map<ProjectType, Vec3>()
  const plots = new Map<string, { dir: Vec3; slot: Slot }>()
  let fallbackIdx = 0
  const nUnmapped = trees.filter((t) => !BASE_PLAN[t.category]).length

  for (const tree of trees) {
    let plan = BASE_PLAN[tree.category]
    if (!plan) {
      // A category the plan doesn't zone gets a plot on a wide outer ring, so a
      // race added to the dataset appears somewhere sane rather than at the
      // origin on top of the core.
      const a = (fallbackIdx / Math.max(nUnmapped, 1)) * Math.PI * 2
      plan = {
        east: Math.cos(a) * FALLBACK_RING_M,
        north: Math.sin(a) * FALLBACK_RING_M,
        turn: 0,
      }
      fallbackIdx++
    }
    districts.set(tree.category, dirAt(plan.east, plan.north))
    const slots = districtSlots(
      plan,
      tree.projects.map((p) => ({ id: p.id, radiusM: footprintRadiusM(p) }))
    )
    for (const [id, slot] of slots) {
      plots.set(id, { dir: dirAt(slot.east, slot.north), slot })
    }
  }
  return { districts, plots }
}

export default function MoonBaseZeroIndex() {
  const router = useRouter()
  const dataset = SEED_ATLAS
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)

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
  // Organizations are the one remaining filter. Project TYPE used to be another,
  // but a race is a type — "the fission power race" and "projects of type power"
  // select the same hardware — so the race list below replaced it rather than
  // sitting beside it offering the same cut twice.
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])

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
      }),
    [dataset.projects, selectedOrgIds]
  )

  // Mount one DePrize market — the open race only. Eight concurrent 30s polls
  // on the r3f scene is exactly what the bridge was designed to avoid.
  const liveOdds = useDePrizeGoalOdds(chain, selectedGoalId ?? undefined)
  // Depend on the bridge fields, not the result object — the hook returns a
  // fresh object every render and would rebuild trees on every hover/frame.
  // Pass the dataset array itself, not a copy: mergeLiveMarketInto returns the
  // same reference when nothing merged, which keeps buildTechTrees and the
  // colony layout memos from recomputing for unbound races.
  const sharedGoals = useMemo(
    () =>
      mergeLiveMarketInto(
        dataset.sharedGoals,
        selectedGoalId ?? undefined,
        liveOdds
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field deps
    [
      dataset.sharedGoals,
      selectedGoalId,
      liveOdds.deprizeId,
      liveOdds.status,
      liveOdds.fieldOdds,
      liveOdds.oddsByProjectId,
    ]
  )

  // One district per capability category (post-filter, so legend filters hide
  // whole districts when their members are filtered out). Live odds for the
  // open race flow in via sharedGoals so rankedMembers / Legend inherit them.
  const trees = useMemo(
    () => buildTechTrees(filteredProjects, sharedGoals),
    [filteredProjects, sharedGoals]
  )

  // What actually stands on the ground: a race's declared competitors, and
  // nothing else. A category can hold projects that are not in its race — the
  // five CLPS-class cargo landers are all type `lander` but none of them is in
  // the crewed-landing race, and NASA's LTV is the contract the three rover bids
  // are competing FOR rather than a competitor in it. Giving those a plot would
  // put hardware on the map that no race explains and no filter can reach, so
  // the surface is races only. They keep their dataset entries and their panels.
  const surfaceTrees = useMemo(
    () =>
      trees
        .map((t) =>
          t.goal
            ? {
                ...t,
                projects: t.projects.filter((p) =>
                  t.goal!.projectIds.includes(p.id)
                ),
              }
            : t
        )
        .filter((t) => t.projects.length > 0),
    [trees]
  )

  // Shared plot and district positions so markers, models, roads and camera
  // focus all agree on where each competitor stands. A zoned district layout
  // gathers the whole field into one connected settlement instead of piling
  // every project at its overlapping real coordinates.
  const layout = useMemo(() => buildColonyLayout(surfaceTrees), [surfaceTrees])

  // The race list that drives the panel, ordered biggest field first — the more
  // companies are chasing a capability, the more of a race it is.
  const races = useMemo<RaceEntry[]>(
    () =>
      [...surfaceTrees]
        .sort((a, b) => b.projects.length - a.projects.length)
        .map((tree) => {
          const leader = rankedMembers(tree)[0]
          const leaderOrg = leader ? orgById(dataset, leader.orgId) : undefined
          return {
            category: tree.category,
            label: PROJECT_TYPE_LABEL[tree.category],
            count: tree.projects.length,
            leaderName: leaderOrg?.name,
            leaderColor: orgColor(leaderOrg),
          }
        }),
    [surfaceTrees, dataset]
  )

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
        ? sharedGoals.filter((g) =>
            selectedProject.sharedGoalIds.includes(g.id)
          )
        : [],
    [sharedGoals, selectedProject]
  )

  const selectedGoal: SharedGoal | undefined = selectedGoalId
    ? sharedGoals.find((g) => g.id === selectedGoalId)
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

  // The direction of a race district's centre on the globe.
  const siteDir = (category: ProjectType) => layout.districts.get(category)

  // Fly in close and centred on a specific competitor's own plot. Now that
  // every competitor stands on its own ground this can frame the asset itself
  // rather than the district — which is the point of picking one out of a list
  // of four. Falls back to the district, then to the project's real location.
  const flyToProject = (project: Project, siteCategory?: ProjectType | null) => {
    // A competitor whose hardware is in orbit is framed at its station instead.
    // It keeps its ground lot — a relay service needs a ground segment, and that
    // terminal is real hardware on real regolith — but the satellites are what
    // the program IS, and they are not visible from the wide shot at any
    // altitude that is not a lie (see lib/lunar-atlas/skyplan).
    const stations = SKY_STATIONS[project.id]
    if (stations?.length) {
      const { lat, lon } = stationLatLon(stations[0])
      setFocus({ lat, lon, view: 'sky', heightM: stations[0].altM })
      return
    }
    const cat = siteCategory ?? selectedTreeCategory ?? project.type
    const dir = layout.plots.get(project.id)?.dir ?? siteDir(cat)
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

  // Keep ?race= / ?year= in sync with selection without remounting the scene.
  //
  // `pathname` must stay whatever route is mounted. `/moonbase/[projectId]`
  // re-exports this component, but it is still a different page entry, so
  // rewriting the path to `/moonbase` would be a real navigation — shallow is
  // ignored across pages — and would tear down and rebuild the whole r3f scene
  // for anyone who arrived from a competitor deep link. Keeping the dynamic
  // segment (and its `projectId` query key, which Next interpolates back into
  // the path) makes every update a same-page shallow replace.
  const replaceMoonbaseQuery = (patch: {
    race?: string | null
    year?: number | null
  }) => {
    if (!router.isReady) return
    const next: Record<string, string | string[] | undefined> = {
      ...router.query,
    }
    if (patch.race === null) delete next.race
    else if (patch.race !== undefined) next.race = patch.race
    if (patch.year === null) delete next.year
    else if (patch.year !== undefined) next.year = String(patch.year)
    void router.replace({ pathname: router.pathname, query: next }, undefined, {
      shallow: true,
    })
  }

  // Honor `/moonbase/[projectId]` deep links once the router has the param.
  useEffect(() => {
    if (!router.isReady) return
    const id = router.query.projectId
    if (typeof id !== 'string' || !id) return
    if (!projectById(dataset, id)) return
    handleSelectProject(id)
    // Only react to the deep-link param itself; selection handlers stay stable
    // enough for a one-shot open on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.projectId])

  // Honor ?race= / ?year= on the index route.
  useEffect(() => {
    if (!router.isReady) return
    const race =
      typeof router.query.race === 'string' ? router.query.race : undefined
    if (race && sharedGoalById(dataset, race) && race !== selectedGoalId) {
      handleSelectSharedGoal(race, { skipUrl: true })
    }
    const yearRaw =
      typeof router.query.year === 'string' ? router.query.year : undefined
    if (yearRaw) {
      const y = Number.parseInt(yearRaw, 10)
      if (
        Number.isFinite(y) &&
        y >= yearRange.min &&
        y <= yearRange.max &&
        y !== year
      ) {
        setYear(y)
        setPlaying(false)
      }
    }
    // One-shot open from the URL; selection handlers write the URL themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.race, router.query.year])

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
    replaceMoonbaseQuery({
      race: tree.goal?.id ?? null,
      year,
    })
  }

  // Opening a goal directly (from a ProjectPanel link, race zone, or ?race=)
  // also highlights its category's site when it has one.
  const handleSelectSharedGoal = (
    goalId: string,
    opts?: { skipUrl?: boolean }
  ) => {
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
        // ~200 m above the site — close enough that a real-scale base reads.
        distanceRadii: 200 / MOON_RADIUS_M,
      })
    }
    if (!opts?.skipUrl) replaceMoonbaseQuery({ race: goalId, year })
  }

  // Backing out of a selection returns to the South Pole overview (home),
  // not the full-globe view — that is where the user was working.
  const clearSelection = () => {
    setSelectedProjectId(null)
    setSelectedGoalId(null)
    setSelectedTreeCategory(null)
    setRaceReturn(null)
    setFocus(null)
    replaceMoonbaseQuery({ race: null, year })
  }

  // Clicking the lunar surface or empty space backs out of whichever panel
  // is open. Without a selection it does nothing — it must not yank the
  // camera away from a hotspot the user chose.
  const handleBackgroundClick = () => {
    if (selectedProjectId || selectedGoalId || selectedTreeCategory)
      clearSelection()
  }

  // Pressing the open race again closes it, which is what a list of eight rows
  // wants — otherwise the only way back to the whole colony is to click the
  // regolith, and nothing says so.
  const handleToggleRace = (category: ProjectType) => {
    if (category === selectedTreeCategory) clearSelection()
    else handleSelectTree(category)
  }

  const toggleOrg = (id: string) =>
    setSelectedOrgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  const clearFilters = () => setSelectedOrgIds([])

  return (
    <>
      <Head
        title="Moon Base Zero"
        description="A true-to-scale moonbase on the Shackleton connecting ridge — real NASA LOLA terrain at 5 m/px. Explore capability races, competitors, and who's leading each tech tree."
      />
      <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#03040a]">
        <MoonGlobeLazy
          focus={focus}
          trees={surfaceTrees}
          organizations={dataset.organizations}
          selectedTreeCategory={selectedTreeCategory}
          selectedProject={selectedProject ?? null}
          hoveredCategory={hoveredCategory}
          onSelectTree={handleSelectTree}
          onSelectProject={handleSelectProject}
          onHoverTree={setHoveredCategory}
          getProjectStyle={getProjectStyle}
          layout={layout}
          onBackgroundClick={handleBackgroundClick}
        />

        {/* Overlay HUD */}
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 p-4 sm:p-6">
            <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="h-5 w-5 text-cyan-300" />
                <h1 className="text-lg font-semibold text-white">Moon Base Zero</h1>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                A true-to-scale moonbase on the Shackleton connecting ridge —
                every serious program is racing here. Click a site to explore
                its capability race, competitors, and sources.
              </p>
            </div>

            <Legend
              races={races}
              selectedRace={selectedTreeCategory}
              onSelectRace={handleToggleRace}
              onHoverRace={setHoveredCategory}
              organizations={dataset.organizations}
              selectedOrgIds={selectedOrgIds}
              onToggleOrg={toggleOrg}
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
                replaceMoonbaseQuery({
                  race: selectedGoalId,
                  year: y,
                })
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
                deprizeId={liveOdds.deprizeId}
                chainSlug={chainSlug}
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
