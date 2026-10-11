import { useMemo } from 'react'
import { latLonToVector3 } from '@/lib/lunar-atlas/geo'
import type { Vec3 } from '@/lib/lunar-atlas/geo'
import { capOffsetLatLon } from '@/lib/lunar-atlas/southpole'
import {
  BASE_PLAN,
  FALLBACK_ALONG_M,
  FALLBACK_SPREAD_M,
  PATROL,
  at,
  districtSlots,
  shuttleAt,
  shuttleLapM,
  type Slot,
} from '@/lib/lunar-atlas/baseplan'
import { buildTechTrees, type TechTree } from '@/lib/lunar-atlas/selectors'
import type { Project, ProjectType, SharedGoal } from '@/lib/lunar-atlas/types'
import {
  rankedMembers,
  type ColonyLayout,
} from '@/components/lunar-atlas/MarkerLayer'
import {
  footprintRadiusM,
  hasOwnModel,
} from '@/components/lunar-atlas/ProjectModel'

// The scene IS the Shackleton connecting ridge now — a single photorealistic
// 16x16 km LOLA-derived patch, no full globe. The home view is a null focus,
// which the globe's CameraRig frames with its oblique three-quarter
// DEFAULT_CAM (not a top-down orbit).

// A surface direction from an offset in meters on the ridge patch.
export function dirAt(eastM: number, northM: number): Vec3 {
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
export function buildColonyLayout(trees: TechTree[]): ColonyLayout {
  const districts = new Map<string, Vec3>()
  const districtOwner = new Map<ProjectType, string>()
  const plots = new Map<
    string,
    { dir: Vec3; slot: Slot; standDir?: Vec3 }
  >()
  let fallbackIdx = 0
  // The plan zones one district per hardware type, so when two races run the
  // same hardware only the first can stand in it — the second is as unzoned as
  // a type the plan never heard of. Count it that way or the outlier row is
  // spaced for fewer races than actually stand in it.
  const zoned = new Set<ProjectType>()
  const isZoned = (t: TechTree) => {
    if (!BASE_PLAN[t.category] || zoned.has(t.category)) return false
    zoned.add(t.category)
    return true
  }
  // Which race gets the zoned district when two want it: the one whose goal
  // DECLARES that category, because that is the dataset saying "this is the
  // landing race". Without this the winner is whoever sorts first by id, which
  // would hand the landing zone to the crewed-lander race and stand Touchdown
  // out on open regolith. A race with an inferred category goes last — it never
  // claimed the ground, it just happens to field that hardware.
  const claimRank = (t: TechTree) =>
    t.goal?.category === t.category ? 0 : t.goal ? 2 : 1
  const ordered = [...trees].sort((a, b) => claimRank(a) - claimRank(b))

  // Where a race is allowed to stand, and whether it stands at all. Two rules,
  // each named for the duplicate district it exists to stop.
  //
  // A race takes the district the plan drew for its hardware. When two races
  // run the same hardware only the first can have it, and the second does NOT
  // get a consolation plot out on the regolith: Touchdown and the crewed
  // landing are both lander races, and siting both put two lander clusters on
  // the map — the second with no road to it, because the outlier row has no
  // street. Same for the LTV against the rover district. A race in that
  // position waits for ground of its own rather than standing next to the
  // district it is a duplicate of.
  //
  // Hardware the plan never zoned is the different case the outlier row was
  // built for: there is no district it could be mistaken for, so it stands
  // past the head of the spine. But out there it has no district of like
  // hardware to make a generic model read correctly, so every machine has to
  // be itself. Night Shift fields seven reactors all typed `other`, all
  // unmodelled, which is seven identical crates under seven companies' names.
  //
  // A race that stands nowhere keeps its legend row, its panel and its market.
  const unplanned = (t: TechTree) => !BASE_PLAN[t.category]
  const canStand = (t: TechTree, zonedHere: boolean) =>
    zonedHere || (unplanned(t) && t.projects.every(hasOwnModel))

  const nUnmapped = ordered.filter(
    (t) => !isZoned(t) && canStand(t, false)
  ).length
  zoned.clear()

  for (const tree of ordered) {
    const takesDistrict = isZoned(tree)
    if (!canStand(tree, takesDistrict)) continue
    if (takesDistrict) districtOwner.set(tree.category, tree.raceId)
    let plan = takesDistrict ? BASE_PLAN[tree.category] : undefined
    if (!plan) {
      // A category the plan doesn't zone stands past the head of the spine, so a
      // race added to the dataset appears on open regolith beyond the built
      // plan rather than at the origin on top of the habitat district. Spread
      // ACROSS the spine from there, centred on it, which keeps them together
      // as a row of outliers instead of scattered round the settlement.
      const t = nUnmapped > 1 ? fallbackIdx / (nUnmapped - 1) - 0.5 : 0
      plan = {
        ...at(FALLBACK_ALONG_M, t * FALLBACK_SPREAD_M * 2),
        alongM: FALLBACK_ALONG_M,
        turn: 0,
        // No road runs out here, so there is no dead end to arrange around and
        // no street to set back from: the outliers simply stand in a line.
        front: 'lot',
      }
      fallbackIdx++
    }
    districts.set(tree.raceId, dirAt(plan.east, plan.north))
    // A competitor entered in two races (Chang'e-7 runs in Touchdown and Water
    // Ice) stands on one plot, owned by whichever race claims it first. Packing
    // still counts it in both districts so neither leaves a gap where it would
    // have stood.
    const slots = districtSlots(
      plan,
      tree.projects.map((p) => ({ id: p.id, radiusM: footprintRadiusM(p) }))
    )
    // A race whose hardware DRIVES is shown twice: parked on its plots like
    // everyone else, and again out on the spine as a moving scenery copy,
    // spread along the run by rank (see PATROL and the shuttle in MarkerLayer's
    // CompetitorPlot). This is where that second copy starts from. Uses the
    // identical phase MarkerLayer does — rank index over count — and the same
    // `shuttleAt`, so the two cannot disagree about where a rover sets off.
    const patrol = PATROL[tree.category]
    const rankOf = patrol
      ? new Map(rankedMembers(tree).map((p, i) => [p.id, i]))
      : null
    for (const [id, slot] of slots) {
      if (plots.has(id)) continue
      let standDir: Vec3 | undefined
      if (patrol && rankOf) {
        const phase = rankOf.get(id)! / rankOf.size
        const { east, north } = shuttleAt(
          patrol,
          phase * shuttleLapM(patrol)
        )
        const ll = capOffsetLatLon(east, north)
        standDir = latLonToVector3(ll.lat, ll.lon, 1)
      }
      plots.set(id, { dir: dirAt(slot.east, slot.north), slot, standDir })
    }
  }
  return { districts, districtOwner, plots }
}

// Everything the scene needs to stand the base up, from a project list and its
// races: the tech trees, the races that actually stand on the surface, the
// shared layout table, and the races that got ground in it.
//
// What stands on the ground is a race's declared competitors and nothing else.
// A category can hold projects that are not in its race — the five CLPS-class
// cargo landers are all type `lander` but none of them is in the crewed-landing
// race — and giving those a plot would put hardware on the map that no race
// explains and no filter can reach.
//
// The sited filter asks the layout rather than re-deriving canStand: a race it
// gave no district to has no plots either, and handing it to the globe anyway
// would render a district's worth of hardware at the origin.
export function useSitedColony(projects: Project[], sharedGoals: SharedGoal[]) {
  const trees = useMemo(
    () => buildTechTrees(projects, sharedGoals),
    [projects, sharedGoals]
  )
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
  const layout = useMemo(() => buildColonyLayout(surfaceTrees), [surfaceTrees])
  const sitedTrees = useMemo(
    () => surfaceTrees.filter((t) => layout.districts.has(t.raceId)),
    [surfaceTrees, layout]
  )
  return { trees, surfaceTrees, layout, sitedTrees }
}
