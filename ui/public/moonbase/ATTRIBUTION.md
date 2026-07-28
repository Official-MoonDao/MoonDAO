# Moon Base Zero — asset attribution

Terrain assets are derived from **public-domain NASA data**; the 3D models are a
mix of **NASA 3D Resources** and one third-party community model (noted below).

## 3D models (`models/`)

Except where noted, every GLB is from **NASA 3D Resources**
(<https://science.nasa.gov/3d-resources/>, mirrored at
<https://github.com/nasa/NASA-3D-Resources>). NASA 3D Resources assets are free
and without copyright; see the
[NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
Models marked "optimized" were Draco-compressed with `@gltf-transform`
(geometry only; no remodeling) to keep web payloads small.

| File | Source model | Used for |
|---|---|---|
| `starship-hls.glb` (edited) | Third-party "SpaceX Starship Ship 24 / Booster 7" community model (Sketchfab; verify license before production use) | Starship HLS — see note |
| `viking-lander.glb` | Viking Lander (NASA) | Blue Moon MK1 cargo lander (stand-in) |
| `insight-lander.glb` (optimized) | InSight Cruise Lander (NASA) | Not currently rendered — Blue Moon MK2 is now a purpose-built procedural model (`BlueMoonMk2` in `ProjectModel.tsx`). Kept because the file ships in `public/`. |
| `perseverance-rover.glb` | Mars 2020 Perseverance Rover (NASA) | NASA LTV (rover stand-in) |
| `rassor.glb` | RASSOR (Regolith Advanced Surface Systems Operations Robot) (NASA) | Not currently rendered — the ISRU site uses a procedural solar-thermal plant. Kept because the file ships in `public/`. |
| `habitat-demo-unit.glb` | Habitat Demonstration Unit (NASA) | Not currently rendered — Artemis Base Camp is a procedural camp (domes, habitat, PV farm). Kept because the file ships in `public/`. |
| `astronaut.glb` | Astronaut (NASA) | Not currently rendered — crew figures are a procedural, jointed rig (`AstronautRig` / `PatrollingAstronaut` in `ProjectModel.tsx`) so they can walk. Kept because the file ships in `public/`. |

`starship-hls.glb` was produced from the full ship-24 + booster-7 stack by
removing every mesh below the interstage (Y < 12.3 in model space), keeping only
the **upper-stage Ship** — the part that lands on the Moon — then Draco-compressing
the result (36 MB → ~1.9 MB). Its upstream Sketchfab source/license should be
confirmed and recorded here before any production release.

The other commercial vehicles (Blue Origin Blue Moon, the LTV competitors) have
**no free, brand-accurate, photoreal model** available; the closest real NASA
spacecraft are used as honest, visually-distinct stand-ins. Types without any
suitable model (fission surface power, regolith construction / ISRU plants) fall
back to procedural geometry in `ProjectModel.tsx`.

## Earth backdrop (`earth/`)

The fixed Earth prop rendered by `EarthGlobe.tsx` (day map, night lights, and
cloud layer). All three are NASA public-domain source imagery (Blue Marble
day composite, Black Marble / DMSP city-lights composite, and a MODIS cloud
composite), redistributed as processed textures in the MIT-licensed three.js
project's own example assets and mirrored here rather than re-fetched from
NASA's own (much larger, unprocessed) originals.

| File | Source | Used for |
|---|---|---|
| `earth-day.jpg` | `three.js/examples/textures/planets/earth_atmos_2048.jpg` | Day-side albedo map |
| `earth-lights.png` | `three.js/examples/textures/planets/earth_lights_2048.png` | Night-side city lights (emissive map) |
| `earth-clouds.png` | `three.js/examples/textures/planets/earth_clouds_1024.png` | Cloud layer |

Source: <https://github.com/mrdoob/three.js> (MIT license), `examples/textures/planets/`.

## Connecting Ridge terrain (`southpole/`)

Baked from the **PGDA "Improved LOLA Elevation Maps for South Pole Landing
Sites" Site01 DEM** — a 5 m/px, 16×16 km polar stereographic elevation model
of the **Shackleton–de Gerlache connecting ridge** (the Artemis-era landing
zone), produced from Lunar Orbiter Laser Altimeter data by NASA GSFC.
Source: [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78)
(`Site01_final_adj_5mpp_surf.tif`, MOON_ME frame).

| File | Derivation |
|---|---|
| `height_rg.png` | 16-bit heights split across the R (high byte) / G (low byte) channels, normalized to the patch's height range. True vertical scale (no exaggeration) — the moonbase on it is 1:1. |
| `albedo.jpg` | Synthesized neutral-regolith albedo with the hillshade lighting baked in at the DEM's native 5 m/px, plus cavity shading and grain (lunar regolith is near-uniform albedo; there is no usable optical imagery of the mostly-shadowed pole). |

Rebuild with `ui/scripts/build-southpole-assets.py` (documents the exact
pipeline and the constants shared with `ui/lib/lunar-atlas/southpole.ts`).

- **Elevation:** LOLA site DEMs — Barker, M. K., et al. (2021), "Improved
  LOLA Elevation Maps for South Pole Landing Sites: Error Estimates and Their
  Impact on Illumination Conditions", Planetary & Space Science 203, 105119.
- **License:** NASA data is generally not copyrighted and is free to use (see
  [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).
