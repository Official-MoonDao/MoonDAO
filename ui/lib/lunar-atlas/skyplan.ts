// The orbital half of the base plan.
//
// Almost everything in this scene is hardware standing on regolith, laid out by
// baseplan.ts. Three competitors are not: Intuitive Machines' relay
// constellation, ESA's Lunar Pathfinder, and Crescent's Parsec, all answers to
// the same problem — a crew at 89°S needs to talk to Earth even when Earth
// spends part of every month below their horizon — flown as spacecraft rather
// than ground infrastructure. A ground lot cannot represent that, so all three
// get stations in the sky instead.
//
// THE ALTITUDE IS A PORTRAYAL, AND THE ONLY ONE IN THIS SCENE. Everything else
// on the ridge is true to scale at its true position; these satellites are
// parked a few hundred meters up, where IM's relay orbits at tens to hundreds
// of kilometers and Pathfinder's elliptical frozen orbit runs from 673 to 7331
// km. At a true orbital altitude even IM's 20 m spacecraft subtends about a
// thousandth of a degree — it is not a small object on screen, it is no object
// at all — and at true orbital speed it would cross the window in a fraction of
// a second. Both numbers are unusable, so every station here is drawn at a
// height where it can be seen and held where it can be looked at. What IS
// honest is everything else about it: each satellite is its real span, its
// arrays face the real sun, and IM's high-gain dish points where Earth really
// is from here (see SAT_DISH_EL in ProjectModel).
//
// The satellite counts are not a portrayal — they are the actual state of all
// three programs. IM flies three because it holds an operational relay
// contract; Pathfinder flies one because it is still the single SSTL-built
// precursor ahead of the Moonlight constellation it is meant to lead; Parsec
// flies two because that is Lockheed's own published figure for how the
// network starts — a deliberately different number from either neighbor, and
// the whole point of Crescent's pitch: a service that scales by adding cheap
// nodes rather than committing to one bird's full capability up front.
//
// The stations are not evenly spaced, and that is deliberate. IM's three are
// composed for the one view that frames them (see SKY_VIEW_OPTS in MoonGlobe):
// the nearest satellite fills an eighth of the frame, a second sits half that
// size up and to the left, a third smaller again to the right, and the colony
// lies below all three. Spacing them evenly around a ring put two of the three
// outside the frame entirely, which is a constellation the user cannot see.
// Pathfinder's and Parsec's stations only have to clear the same bar on their
// own: a bearing that keeps the sun behind the eye (see the note on IM's
// primary, below) and a ring/altitude far enough from every other program's
// that the sky doesn't collapse into one crowded cluster when all three are
// on screen at once.

import { latLonToVector3, type Vec3 } from './geo'
import { CAP_CENTER_HEIGHT_M, capOffsetLatLon, heightToRadius } from './southpole'

export type SkyStation = {
  // Degrees CCW from east, the same bearing convention the districts use.
  bearingDeg: number
  // Horizontal distance from the ridge center, in meters.
  ringM: number
  // Meters above the base's datum height — so 420 is 420 m over the colony,
  // and the 52 m Starship is the tallest thing anywhere near it.
  altM: number
  // Compass bearing the wing axis runs along. The panel faces are square to
  // this, so it is really a statement about where the sun is: at 89°S the sun
  // circles the horizon a couple of degrees up and never climbs, so an array
  // earns its area by standing upright across the sun's bearing rather than
  // lying flat. The sun sits at bearing 50°, hence a wing axis near 140°.
  wingBearingDeg: number
}

// Which projects fly rather than stand. Keyed by project id, exactly like the
// per-project models in ProjectModel — a dataset entry alone cannot say this,
// because whether a program's hardware is orbital is a fact about the hardware
// and not about the row.
export const SKY_STATIONS: Record<string, SkyStation[]> = {
  'im-near-space-network': [
    // The primary, and the one the camera flies to. Its bearing is set by the
    // LIGHT: from a viewpoint that stands off outward from this station, the sun
    // is squarely behind the eye, so the satellite presents a fully sunlit face
    // rather than a silhouette. Bearings around 210–240° are the opposite —
    // back-lit, and the model disappears into its own shadow.
    { bearingDeg: 60, ringM: 180, altM: 420, wingBearingDeg: 140 },
    // Nearer the colony and lower, which is what puts it further along the
    // sight line from the primary's view and so smaller in frame: looking DOWN
    // at 49°, distance maps to height on screen, and anything at the primary's
    // own altitude that is far enough to read as distant has left the top of
    // the frame.
    { bearingDeg: 320, ringM: 140, altM: 300, wingBearingDeg: 128 },
    // Furthest and lowest of the three, out past the colony's far side.
    { bearingDeg: 190, ringM: 360, altM: 160, wingBearingDeg: 152 },
  ],
  // A single station for a single spacecraft. Bearing 100° keeps clear of both
  // IM's ring (60/320/190) and the 210–240° back-lit band; ring and altitude
  // put it further out and higher than any of IM's three, so the two programs
  // read as separate constellations rather than one crowded sky.
  'esa-lunar-pathfinder': [
    { bearingDeg: 100, ringM: 260, altM: 500, wingBearingDeg: 140 },
  ],
  // Two stations for Crescent's starting pair — bearings 20° and 340° sit in
  // the same sunlit band as IM's primary and Pathfinder's station, clear of
  // the 210–240° back-lit zone, and the ring/altitude pair (200/380 and
  // 150/300) sits inside IM's own spread rather than past it, so Parsec's two
  // small nodes read as nearer and smaller than the other programs' hardware —
  // which, at a fraction of their bus mass, they are.
  'crescent-parsec': [
    { bearingDeg: 20, ringM: 200, altM: 380, wingBearingDeg: 132 },
    { bearingDeg: 340, ringM: 150, altM: 300, wingBearingDeg: 148 },
  ],
  // One station, for the one relay in this race that is already flying.
  //
  // It is the furthest out and the lowest of all four programs (430 m at 240 m
  // altitude, where the American and European birds sit between 150 and 360 m
  // out and 300 to 500 m up), which is not a ranking but a separation: three of
  // these programs are selling into the same Western market and read as one
  // cluster, and Queqiao-2 answers to nobody in it. Standing it off on its own
  // arc says that before any panel does.
  //
  // Bearing 40° is the lighting choice. The 4.2 m reflector is pitched down
  // and OUTWARD (see QQ_DISH_PITCH), so unlike the Earth-pointing relays the
  // face worth seeing is the one turned away from the colony — which puts the
  // sun, at bearing 50°, almost directly behind an eye standing off outward
  // here. Bearings past about 95° swing that gold mesh into its own shadow.
  'queqiao-2': [{ bearingDeg: 40, ringM: 430, altM: 240, wingBearingDeg: 134 }],
}

// Meters east and north of the ridge center.
export function stationOffsetM(st: SkyStation): { eastM: number; northM: number } {
  const b = (st.bearingDeg * Math.PI) / 180
  return { eastM: Math.cos(b) * st.ringM, northM: Math.sin(b) * st.ringM }
}

export function stationLatLon(st: SkyStation): { lat: number; lon: number } {
  const { eastM, northM } = stationOffsetM(st)
  return capOffsetLatLon(eastM, northM)
}

// Scene-space radius the satellite's centre rides at. Unlike everything on the
// surface this is measured from the DATUM rather than from the rendered terrain
// under it: a satellite does not follow the ground it happens to be over, and
// three stations that each rose and fell with their own patch of ridge would
// read as a constellation with a suspension problem.
export function stationRadius(st: SkyStation): number {
  return heightToRadius(CAP_CENTER_HEIGHT_M + st.altM)
}

// Unit direction from the Moon's centre to the station.
export function stationDirection(st: SkyStation): Vec3 {
  const { lat, lon } = stationLatLon(st)
  return latLonToVector3(lat, lon, 1)
}
