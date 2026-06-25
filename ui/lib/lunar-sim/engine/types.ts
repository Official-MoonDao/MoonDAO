// Shared domain + runtime types for the MoonSim engine.
// Pure types: safe to import from both the engine (Node/Worker) and the UI.

import type { SimEvent } from './events'

export type { SimEvent, SimEventType } from './events'

export type Visibility = 'public' | 'private'
export type OwnerType = 'citizen' | 'team'
export type ResourceType = 'regolith' | 'ice'
export type BehaviorModule =
  | 'worker_rover_v1'
  | 'lurker_rover_v1'
  | 'isru_factory_v1'

// Local East-North-Up coordinates in meters, relative to the AOI anchor.
export type ENU = { x: number; y: number }

export type ModelTransform = {
  scaleToMeters: number
  rotationEuler?: [number, number, number]
  originOffset?: [number, number, number]
}

export type AOI = {
  body: 'Moon'
  anchorLat: number
  anchorLon: number
  radiusM: number
}

export type Mobility = {
  type: 'static' | 'wheeled'
  maxSpeedMps: number
}

export type Allowance = {
  unit: 'credits'
  maxOfflineRisk: number
  remaining: number
}

export type AssetPlacement = {
  id: string
  name: string
  class: string
  ownerType: OwnerType
  ownerTokenId: number
  pubKey: string
  pos: ENU
  mobility: Mobility
  commsRangeM: number
  cargoCapacityKg: number
  supportedStandards: string[]
  stamps: string[]
  allowance: Allowance
  behaviorModule: BehaviorModule
  modelURI?: string
  modelTransform?: ModelTransform
  visibility: Visibility
  // Optional sim economics / tuning.
  pricePerKg?: number
  extractionRateKgPerSec?: number
}

export type ResourceDeposit = {
  id: string
  name: string
  resourceType: ResourceType
  pos: ENU
  quantityKg: number
  gradePct: number
}

export type CommsWindow = { startSec: number; endSec: number }

export type Scenario = {
  id: string
  name: string
  description: string
  ownerType: OwnerType
  ownerTokenId: number
  createdByCitizenId?: number
  visibility: Visibility
  aoi: AOI
  durationSec: number
  tickSec: number
  timeScale: number
  seed: string
  assets: AssetPlacement[]
  resources: ResourceDeposit[]
  standardIds: string[]
  commsWindows: CommsWindow[]
  registryVersion: { soar: string; siros: string }
  schemaVersion: number
}

export type SirosStandard = {
  id: string
  name: string
  version: string
  domain: string
  status: 'draft' | 'proposed' | 'adopted'
  applicableClasses: string[]
  requiredStamps: string[]
  refs?: string[]
}

export type SoarAssetClass = {
  id: string
  name: string
  category: string
  defaultCapabilities: string[]
  defaultStandards: string[]
  defaultModelURI?: string
  defaultModelTransform?: ModelTransform
}

export type SoarRegistry = { version: string; classes: SoarAssetClass[] }
export type SirosRegistry = { version: string; standards: SirosStandard[] }

export type Receipt = {
  id: string
  scenarioId: string
  tick: number
  sellerAssetId: string
  buyerAssetId: string
  resourceType: ResourceType
  quantityKg: number
  price: number
  currency: 'credits'
  sellerSig: string
  buyerSig: string
  settlementStatus: 'pending_downlink' | 'settled' | 'disputed'
}

// ---- Runtime state ----

export type AssetPhase =
  | 'idle'
  | 'to_deposit'
  | 'mining'
  | 'to_factory'
  | 'trading'

export type AssetState = {
  id: string
  pos: ENU
  phase: AssetPhase
  cargoKg: number
  allowanceRemaining: number
  pendingReceipts: string[]
  cooldownSec: number
}

export type WorldSnapshot = {
  tick: number
  timeSec: number
  commsOpen: boolean
  assets: Record<string, AssetState>
  depositsRemainingKg: Record<string, number>
}

export type RunReport = {
  simHash: string
  durationSec: number
  ticks: number
  acceptedTx: number
  rejectedTx: number
  regolithDeliveredKg: number
  settledValue: number
  unsettledValue: number
  allowanceRemaining: Record<string, number>
  rejectionReasons: Record<string, number>
}

export type SimResult = {
  simHash: string
  scenarioId: string
  events: SimEvent[]
  snapshots: WorldSnapshot[]
  receipts: Receipt[]
  report: RunReport
}
