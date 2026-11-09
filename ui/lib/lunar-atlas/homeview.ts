// The home ("load-in") framing of Moon Base Zero.
//
// This lives in lib rather than in MoonGlobe because two unrelated parts of
// the scene need the same viewpoint: the camera rig starts here, and the
// on-surface models yaw their presentation side toward it (see
// MODEL_FRONT_AZ in ProjectModel). Importing it from the globe component
// would make the model layer depend on its own parent.

import { latLonToVector3, type Vec3 } from './geo'
import {
  CAP_CENTER_HEIGHT_M,
  capOffsetLatLon,
  heightToRadius,
} from './southpole'

// A scene-space point at a map-frame offset (meters east/north of the ridge
// center) and a height in meters above the datum sphere.
export function ridgePoint(
  eastM: number,
  northM: number,
  heightM: number
): Vec3 {
  const ll = capOffsetLatLon(eastM, northM)
  return latLonToVector3(ll.lat, ll.lon, heightToRadius(heightM))
}

// Standing off the settlement rather than surveying it from orbit: the eye is
// ~360 m out at drone height (~140 m), looking north-west across the whole
// colony from the south-east flank.
//
// EVERY district has to be in frame, because the districts are what the page is
// about — a capability race the user cannot see is a race they will not click.
// That is the only constraint here, and it is a hard one: the plan runs from the
// landing zone at -35 m along Main Avenue to the mass driver at +275, and the
// two ends of it are the first things a viewer asks about.
//
// WHY THE EYE IS AS FAR BACK AS IT IS
//
// Because of how wide the base is ACROSS the view, not how deep. Main Avenue
// lies nearly square on to this camera (see the bearing note in baseplan), so
// the colony presents its full ~350 m length as frame WIDTH, and the eye has to
// stand off far enough for that width to fit the horizontal field. At the 42°
// vertical FOV the canvas runs, the horizontal half-angle is ~33° on a laptop
// window and ~29° on a squarer one. The framing is the one the 620 m spine plan
// was tuned to, scaled down with the base: same bearing, same elevation, same
// share of the frame, 0.6 of the distance.
//
// The elevation, ~21°, is a separate and much softer call. Higher reads as a
// site map and flattens the hardware; lower buys nothing, because the base's
// depth is small next to its width and no angle turns 350 m of frontage into
// image height. What the angle is really for is keeping a 4.5 m rover reading as
// a rover rather than a speck on a plan.
//
// WHY THE CAMERA AIMS ABOVE THE GROUND AND NOT AT IT
//
// Fitting the colony to the WINDOW is not the same as fitting it to what the
// user can see, and at this distance the difference decides the shot. The HUD
// covers two bands of the viewport: the title card and the capability-race
// legend across the top (the legend reaches past half the window's height on a
// laptop), and the timeline scrubber across the bottom. What is left is a clear
// strip through the lower-middle of the frame, full width, and that strip is
// where the base has to land. Aimed level at the ground the colony sits high in
// frame, which puts its north-east end — the power district and the mass
// driver's breach works, the two furthest right — squarely behind the legend:
// on screen, still invisible, which is the complaint this framing exists to fix.
//
// So the camera aims at a point ~70 m ABOVE the base centre, which drops the
// whole settlement into the clear strip, leaves the sky it is pitched up into
// for the HUD panels to sit on, and spends the foreground regolith that used to
// fill the bottom third of the frame on the base instead.
//
// East/north are unchanged by the lift, which matters: the models take their
// shared heading from the HORIZONTAL bearing between these two points (see
// facingYaw in ProjectModel), so raising the aim point cannot rotate the base.
// The target also sits just south-east of the base centre rather than on it.
// TrackballControls runs with noPan, so the target is the point the colony
// swings around on a drag; its eccentricity is held to the ~22 m the home view
// has always had.
export const HOME_TARGET = ridgePoint(85, 65, CAP_CENTER_HEIGHT_M + 69)
export const HOME_CAM = ridgePoint(288, -232, CAP_CENTER_HEIGHT_M + 138)

// The colony centre ON THE GROUND, which is a different point from what the
// camera aims at and must not be conflated with it. The sun's shadow frustum is
// centred here: it is an orthographic box a fixed 800 m across pointed down the
// sun vector, so centring it on the camera's raised aim point would slide its
// ground coverage off the base and drop the shadows at one end of town.
export const HOME_GROUND = ridgePoint(85, 65, CAP_CENTER_HEIGHT_M)
