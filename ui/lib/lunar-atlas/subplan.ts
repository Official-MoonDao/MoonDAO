// The subsurface half of the base plan.
//
// baseplan.ts lays out hardware standing on regolith and skyplan.ts flies the
// three spacecraft that are not on the ground at all. This is the third case:
// two competitors whose pressure shells end up UNDER the surface, because the
// thing a first habitat most needs at 89°S is mass overhead.
//
// WHY THESE TWO, AND WHY BURIED AT ALL. Galactic cosmic rays, solar particle
// events, micrometeoroids and a 280 K swing between sun and shadow are all
// answered by the same free material, and every serious study of long-stay
// surface habitation reaches the same conclusion: you do not launch shielding,
// you shovel it. Three to five meters of regolith over the crown is the number
// that keeps recurring, and 4 m is what both vaults here carry. The two
// programs that get this treatment are the two whose competitors are a SINGLE
// PRESSURIZED CAN rather than a whole architecture — Thales' MPH and Sierra's
// LIFE. Artemis Base Camp and ILRS are program-level buildups with mobility,
// power and science spread across a site, and ILRS's own published phases put
// its shielding late; Toyota's Lunar Cruiser drives, and you do not bury a
// vehicle. A can is exactly the thing you can drop in a trench and cover.
//
// WHAT IS AND IS NOT A PORTRAYAL HERE. The engineering is honest: cut-and-cover
// is the mainstream approach, the depths and covers below are in the range the
// literature uses, and the machines that would do the covering are already
// standing two districts over — Redwire's Mason grader and compactor and ICON's
// Olympus exist to build berms and print structures out of regolith, which is
// why the shielding milestones in the dataset are sourced to that race rather
// than claimed on either module vendor's behalf. Neither Thales nor Sierra has
// announced that their module will be buried. What IS a liberty is the pairing:
// this scene puts a specific cover over a specific can to show what the
// capability produces, and the vault around it is a design of this scene's own.
//
// NO LAVA TUBES, DELIBERATELY. The obvious way to draw an underground lunar
// habitat is inside a lava tube, and it is wrong HERE. Tubes are mare features
// — Marius Hills, the Mare Tranquillitatis pit — formed in flood basalt. The
// Shackleton–de Gerlache connecting ridge is anorthositic highland crust that
// was never flooded, so there is no tube at 89°S to put anything in. Drawing
// one would be the only outright geological fiction in a scene that otherwise
// declares its single portrayal (see the header of skyplan.ts) and holds to it.
// Cut-and-cover needs no such licence: it works anywhere there is loose
// regolith, which is everywhere on this ridge.
//
// HOW IT STAYS OBSERVABLE. A buried habitat keeps its corner lot and
// its whole surface expression — mound, airlock head house, radiator wall, PV,
// spoil pile — so it is picked, hovered and framed exactly like every other
// competitor, and nothing in the layout or the panels needs to know it is
// buried. What changes is only where the camera goes when it is selected: the
// eye drops below grade into the vault (see `view: 'sub'` in MoonGlobe and
// subViewFraming in geo.ts). It reads as a section drawing rather than as a
// hole in the ground, which is both cheaper and more honest — the ground is one
// continuous height-mapped cap with nothing behind it, so there is no hole to
// cut and nothing that would be revealed by cutting one.

import { SPINE_BEARING_DEG, spineCoords } from './baseplan'
import { type Vec3 } from './geo'
import { capLocalDirection } from './southpole'

// A vault, as the numbers a builder would actually be given. Everything else
// about the site — mound size, where the camera stands, how much ground the
// district packer has to reserve — is DERIVED from these by vaultGeometry
// below, rather than being listed alongside them. That matters more here than
// it looks: the camera has to end up inside the vault the model draws, and a
// hand-tuned eye depth beside a hand-tuned floor depth is precisely the pair
// that drifts apart the first time either is touched.
export type SubsurfaceSite = {
  // Depth of the vault floor below LOCAL GRADE, in meters — the excavation.
  floorDepthM: number
  // Interior clear span (across the axis) and length (along it).
  spanM: number
  lengthM: number
  // Height of the straight side wall the barrel arch springs from. The arch is
  // a semicircle of spanM/2 on top of it, so the interior crown stands
  // wallM + spanM/2 above the floor.
  wallM: number
  // Regolith over the OUTSIDE of the liner crown. Both vaults carry 4 m.
  coverM: number
  // The module's centreline above the vault floor, and how far along the axis
  // its centre sits from the plot centre. The offset is what opens up a service
  // bay at the inward end: somewhere for the shaft, the plant and — not
  // incidentally — the camera to stand.
  moduleAxisM: number
  moduleOffsetM: number
}

// Which projects are buried, keyed by project id. Keyed by ID and not by type
// for the same reason SKY_STATIONS is: whether a program's hardware ends up
// under regolith is a fact about that hardware, not about the dataset row, and
// three of the five competitors in this same race stay on the surface.
export const BURIED_HABITATS: Record<string, SubsurfaceSite> = {
  // Thales' MPH — a rigid module 4.1 m across, delivered ready to live in, on
  // its own landing legs. The smaller of the two vaults in every dimension
  // because the thing it covers is the smaller can: an 8 m span clears the hull
  // with a walkway either side, and a 5.4 m interior crown clears the airlock
  // tower's dome (4.6 m over its own feet) and the barrel crown (4.8 m) with
  // room to spare. A 7 m excavation puts the liner crown 1.1 m BELOW grade, so
  // the 4 m of cover stands 2.9 m proud of the lot as a mound rather than
  // being buried flush — which is both the cheaper build (less digging) and the
  // only version you can see anything of from the surface.
  //
  // moduleAxisM is MPH_Y and the offset holds the gangway's foot clear of the
  // camera's own standing spot; both are checked against the model, not chosen.
  'thales-mph': {
    floorDepthM: 7,
    spanM: 8,
    lengthM: 20,
    wallM: 1.4,
    coverM: 4,
    moduleAxisM: 2.75, // MPH_Y: the shell's centreline over its own feet
    moduleOffsetM: 2.2,
  },
  // Sierra's LIFE — softgoods, and the case for burying it is stronger than
  // for the rigid module next door, not weaker: fabric brings no shielding of
  // its own, and the 8.3 m diameter that is the whole argument for inflatables
  // is also 8.3 m of hull with nothing over it. It needs the bigger hole in
  // every direction: a 13 m span and a 2.8 m springing wall put the interior
  // crown 9.3 m over the floor, which clears the shell's 8.55 m crest by 0.75
  // m. The 11 m excavation is what keeps its mound the same 2.8 m height as
  // the MPH's despite a vault half again as tall — the two read as one
  // engineering practice rather than two unrelated earthworks.
  'sierra-space-life': {
    floorDepthM: 11,
    spanM: 13,
    lengthM: 20,
    wallM: 2.8,
    coverM: 4,
    moduleAxisM: 4.4, // LIFE_Y: the shell's axis over its own cradle
    moduleOffsetM: 2.5,
  },
}

// Liner thickness, in meters — sintered/cast regolith over a hoop frame, the
// product the construction race two districts over is selling.
export const LINER_M = 0.5

// End wall thickness. Thicker than the barrel: it takes the cover's thrust at
// the ends with no arch action to help it.
const END_WALL_M = 0.6

// Angle of repose for the cover, in degrees. Loose regolith stands at about
// 30–35°; a graded and compacted berm holds steeper, and 40° is what the Mason
// compactor's whole product is for. It matters here because it sets the mound's
// PLAN SIZE — every degree shallower spreads the skirt further across a lot
// that the base camp and ILRS are already standing on.
const REPOSE_DEG = 40

// Standing eye height, and how far in from the end wall the eye stands.
const EYE_HEIGHT_M = 1.75
const EYE_INSET_M = 2

// Everything the scene needs that isn't authored above. Derived in one place so
// the model layer and the camera cannot disagree about the vault they are
// respectively drawing and standing inside.
export type VaultGeometry = SubsurfaceSite & {
  // Interior crown, above the floor.
  crownM: number
  // Outside of the liner crown, relative to GRADE. Negative when the arch
  // finishes below the surface, which is the case for both vaults here.
  linerCrownM: number
  // Mound crest above grade.
  crestM: number
  // Horizontal run the cover takes to fall from the crest to grade.
  batterM: number
  // Mound half-axes in plan: along the vault axis, and across it.
  moundHalfLengthM: number
  moundHalfWidthM: number
  // Radius of ground the district packer must reserve — the mound's greatest
  // reach from the plot centre, which for an elliptical berm is its longer
  // half-axis (footprintRadiusM in ProjectModel reads this).
  footprintM: number
  // The cutaway framing, in meters below grade and along the axis.
  eyeDepthM: number
  subjectDepthM: number
  standoffM: number
}

export function vaultGeometry(site: SubsurfaceSite): VaultGeometry {
  const crownM = site.wallM + site.spanM / 2
  const linerCrownM = -site.floorDepthM + crownM + LINER_M
  const crestM = linerCrownM + site.coverM
  // Only the part of the cover that stands ABOVE grade has anywhere to spread
  // to. Below grade the trench wall holds it, so a vault that finishes under
  // the surface contributes no batter at all.
  const batterM = Math.max(0, crestM) / Math.tan((REPOSE_DEG * Math.PI) / 180)
  const moundHalfLengthM = site.lengthM / 2 + END_WALL_M + batterM
  const moundHalfWidthM = site.spanM / 2 + LINER_M + batterM
  return {
    ...site,
    crownM,
    linerCrownM,
    crestM,
    batterM,
    moundHalfLengthM,
    moundHalfWidthM,
    footprintM: Math.max(moundHalfLengthM, moundHalfWidthM),
    eyeDepthM: site.floorDepthM - EYE_HEIGHT_M,
    subjectDepthM: site.floorDepthM - site.moduleAxisM,
    // From the plot centre back to the eye: the far end of the service bay,
    // held clear of the end wall, plus however far the module was pushed the
    // other way. The result is a shot straight down the vault's length with
    // the module filling it and the arch reading either side.
    standoffM: site.lengthM / 2 - EYE_INSET_M,
  }
}

export function buriedSite(projectId: string): SubsurfaceSite | undefined {
  return BURIED_HABITATS[projectId]
}

export function buriedVault(projectId: string): VaultGeometry | undefined {
  const site = BURIED_HABITATS[projectId]
  return site && vaultGeometry(site)
}

// Compass bearing (degrees CCW from east, the convention every district and sky
// station here uses) that a vault's long axis runs along: ACROSS the spine, on
// the habitat branch's own line, with the service bay and head house at the end
// nearer the street.
//
// Along the branch rather than along the spine, and it is not an aesthetic
// choice. The habitat race takes the four corner lots of its crossing (see the
// 'crossroads' case in districtSlots), and a corner lot is bounded by the spine
// on one side and the branch on the other. A 28 m mound laid ALONG the spine
// would run the full width of the block and out the far side into the next
// lot's clear ground; laid across it, it runs away from the spine into the open
// regolith behind the block, which is the one direction a lot on a crossing has
// depth in. It also puts the entrance at the end nearest the pavement, which is
// where crew coming off the street would actually go in.
//
// This used to be the plot's RADIAL bearing out of the district centre, which
// worked only because that district was a ring of five plots around a plaza and
// its centre was the map origin. There is no ring and no plaza now, so radial
// out of a crossing points diagonally across a corner lot — the one direction
// that fits neither of the two streets the lot fronts.
//
// The SIGN is read off the plot's own position rather than stored per project:
// the corners are assigned by roster rank, so changing any competitor's
// footprint can move a plot to the other side of the spine, and a hardcoded
// bearing would then bury the entrance and open the mound onto empty ground.
export function vaultAxisBearingDeg(slot: {
  east: number
  north: number
}): number {
  // Which side of the spine this lot is on. The axis then points from the lot
  // back toward the spine, so the head house ends up at the street end.
  const inward = spineCoords(slot).acrossM > 0 ? -1 : 1
  return SPINE_BEARING_DEG + 90 * inward
}

// World-space unit direction the vault's long axis runs along. Fed to
// SurfaceAnchor as `noseAlong`, which puts the model's local +X on it — the
// axis the vault, the mound and the module are all authored along.
//
// Deliberately NOT left to the default camera-facing heading (facingYaw): the
// camera has to stand at a known end of a known axis, and a heading solved
// against the home viewpoint is not a number this module can predict.
export function vaultAxis(slot: { east: number; north: number }): Vec3 {
  return capLocalDirection(vaultAxisBearingDeg(slot), 0)
}
