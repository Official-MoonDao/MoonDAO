// Typed accessor for the bundled, MoonDAO-curated seed dataset. This is the
// source of truth shipped with the app; the persistence layer (IPFS + Tableland)
// can override/extend it at runtime.

import type { AtlasDataset } from '../types'
import atlasJson from './atlas.dataset.json'

// Cast through `unknown`: TypeScript infers a wide union for the JSON literal
// (each goal's `impliedOdds` has a different key set), which no longer directly
// overlaps AtlasDataset. The JSON's shape is validated by the unit tests.
export const SEED_ATLAS: AtlasDataset = atlasJson as unknown as AtlasDataset
