// Typed accessor for the bundled, MoonDAO-curated seed dataset. This is the
// source of truth shipped with the app; the persistence layer (IPFS + Tableland)
// can override/extend it at runtime.

import type { AtlasDataset } from '../types'
import atlasJson from './atlas.dataset.json'

export const SEED_ATLAS: AtlasDataset = atlasJson as AtlasDataset
