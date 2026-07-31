// Typed accessor for the bundled, MoonDAO-curated seed dataset.
//
// Phase A (this PR): SEED_ATLAS is the sole runtime source of truth — no IPFS
// fetch or Tableland index yet. Curator write routes and remote persistence
// are deferred to Phase B; `lib/lunar-atlas/server/ownership.ts` is the auth
// scaffold those routes will reuse.

import type { AtlasDataset } from '../types'
import atlasJson from './atlas.dataset.json'

// Cast through `unknown`: TypeScript infers a wide union for the JSON literal
// (each goal's `impliedOdds` has a different key set), which no longer directly
// overlaps AtlasDataset. The JSON's shape is validated by the unit tests.
export const SEED_ATLAS: AtlasDataset = atlasJson as unknown as AtlasDataset
