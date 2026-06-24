// Typed accessors for the bundled seed registries and demo scenario.

import type {
  Scenario,
  SirosRegistry,
  SoarRegistry,
} from '../engine/types'
import demoScenarioJson from './scenario.regolith-demo.json'
import sirosJson from './siros.json'
import soarJson from './soar.json'

export const SEED_SOAR: SoarRegistry = soarJson as SoarRegistry
export const SEED_SIROS: SirosRegistry = sirosJson as SirosRegistry
export const DEMO_SCENARIO: Scenario = demoScenarioJson as Scenario
