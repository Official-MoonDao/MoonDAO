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

// Standing at the edge of the settlement rather than surveying it from orbit:
// the eye is ~268 m out at drone height (~88 m), looking north-west across the
// whole colony, with the 52 m Starship at the back of the pad road.
//
// EVERY district has to be in frame, because the districts are what the page is
// about — a capability race the user cannot see is a race they will not click.
// The colony spans ~240 m east to west and ~320 m from the rover depot to the
// far edge of the landing zone, and it fits from here.
//
// The framing is solved against the part of the viewport the UI leaves BARE, not
// against the window: the timeline covers the bottom fifth and the capability
// panel the right quarter. That uncovered box is centred well above the middle
// of the window, and it is the whole reason the target sits south-east of the
// base centre instead of on it. Aiming short of the colony pitches the camera
// down, which lifts the near districts — habitat and comms — up out from behind
// the timeline. Aiming at the centre does not fit at ANY distance: the colony
// then straddles the middle of the window, and its near edge is behind the
// scrubber however far back the eye goes.
//
// Two things that look like they would help and do not. Raising the elevation
// makes it WORSE past about 24°, because a flatter view of the ground plane maps
// 320 m of depth to more image height, not less — so the angle stays low, which
// is also what keeps a 4.5 m rover reading as a rover instead of a speck. And
// moving the target further off centre would buy a closer shot, but
// OrbitControls runs with noPan, so the target IS the point the colony swings
// around on a drag; its eccentricity is held to the ~22 m the home view has
// always had.
export const HOME_TARGET = ridgePoint(20, 10, CAP_CENTER_HEIGHT_M)
export const HOME_CAM = ridgePoint(171, -211, CAP_CENTER_HEIGHT_M + 88)
