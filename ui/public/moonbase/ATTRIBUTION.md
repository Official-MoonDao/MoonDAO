# Moon Base Zero — asset attribution

All terrain assets are derived from **public-domain NASA data**.

## 3D models (`models/`)

Every GLB is from **NASA 3D Resources** (<https://science.nasa.gov/3d-resources/>,
mirrored at <https://github.com/nasa/NASA-3D-Resources>). NASA 3D Resources assets
are free and without copyright; see the
[NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
Models marked "optimized" were Draco-compressed with `@gltf-transform/cli`
(geometry only; no remodeling) to keep web payloads small.

| File | NASA source model | Used for |
|---|---|---|
| `apollo-lunar-module.glb` | Apollo Lunar Module | Starship HLS, Artemis III (crewed-lander stand-ins) |
| `viking-lander.glb` | Viking Lander | Blue Moon MK1 cargo lander (stand-in) |
| `insight-lander.glb` (optimized) | InSight Cruise Lander | Blue Moon MK2 crewed lander (stand-in) |
| `perseverance-rover.glb` | Mars 2020 Perseverance Rover | Moon RACER LTV, Lunar Voyager LTV, NASA LTV (rover stand-ins) |
| `rassor.glb` | RASSOR (Regolith Advanced Surface Systems Operations Robot) | Blue Alchemist ISRU |
| `habitat-demo-unit.glb` | Habitat Demonstration Unit | Artemis Base Camp |
| `astronaut.glb` | Astronaut | Crew companion on crewed sites |

Landers/rovers for specific commercial vehicles (SpaceX Starship, Blue Origin
Blue Moon, the LTV competitors) have **no free, brand-accurate, photoreal model**
available; the closest real NASA spacecraft are used as honest, visually-distinct
stand-ins. Types without any suitable model (fission surface power, regolith
construction / ISRU plants) fall back to procedural geometry in `ProjectModel.tsx`.

## South-pole terrain (`southpole/`)

Baked from the **LOLA Gridded Data Record `LDEM_75S_120M`** — a 120 m/px
polar stereographic elevation model of the lunar south pole (75°S–90°S) from
the Lunar Orbiter Laser Altimeter aboard Lunar Reconnaissance Orbiter.
Source: [LOLA PDS Data Node](https://imbrium.mit.edu/)
(`DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_120M.IMG`, LRO-L-LOLA-4-GDR-V1.0).

| File | Derivation |
|---|---|
| `height_rg.png` | Inner cap (~369 km square): 16-bit heights split across the R (high byte) / G (low byte) channels, normalized to the crop's height range. |
| `normal.png` | Tangent-space normal map from full-resolution DEM gradients (2× vertical exaggeration, matching the rendered geometry). |
| `albedo.jpg` | Synthesized neutral-regolith albedo with cavity/ambient shading baked from the DEM (lunar regolith is near-uniform albedo; there is no usable optical imagery of the permanently-shadowed pole). |
| `far_height_rg.png`, `far_albedo.jpg` | Full DEM extent (~915 km square) at reduced resolution for the horizon surround; albedo fades to black before the dataset edge. |

Rebuild with `ui/scripts/build-southpole-assets.py` (documents the exact
pipeline and the constants shared with `ui/lib/lunar-atlas/southpole.ts`).

- **Elevation:** Lunar Orbiter Laser Altimeter (LOLA), NASA / GSFC —
  Smith, D. E., et al.
- **License:** NASA data is generally not copyrighted and is free to use (see
  [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).
