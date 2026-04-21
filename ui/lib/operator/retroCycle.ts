import {
  OperatorFlagRecord,
  readOperatorFlag,
  writeOperatorFlag,
} from '@/lib/operator/kv'

export const RETRO_CYCLE_OVERRIDE_KEY = 'retro_cycle_override'

export type RetroCycleOverride = {
  enabled: boolean
  setBy?: string
  note?: string
  setAt?: Date
  expiresAt?: Date | null
}

type StoredRetroCycleOverride = OperatorFlagRecord<{}>

function fromRecord(rec: StoredRetroCycleOverride | null): RetroCycleOverride {
  if (!rec) return { enabled: false }
  if (rec.expiresAt && new Date(rec.expiresAt) < new Date()) {
    return { enabled: false }
  }
  return {
    enabled: !!rec.enabled,
    setBy: rec.setBy,
    note: rec.note,
    setAt: rec.setAt ? new Date(rec.setAt) : undefined,
    expiresAt: rec.expiresAt ? new Date(rec.expiresAt) : null,
  }
}

// Read the retro cycle override flag. Returns { enabled: false } if the flag
// is missing, expired, or KV is unreachable.
export async function getRetroCycleOverride(): Promise<RetroCycleOverride> {
  const rec = await readOperatorFlag<StoredRetroCycleOverride>(
    RETRO_CYCLE_OVERRIDE_KEY
  )
  return fromRecord(rec)
}

export async function setRetroCycleOverride(params: {
  enabled: boolean
  setBy?: string
  note?: string
  expiresAt?: Date | null
}): Promise<RetroCycleOverride> {
  const stored = await writeOperatorFlag<StoredRetroCycleOverride>(
    RETRO_CYCLE_OVERRIDE_KEY,
    {
      enabled: params.enabled,
      setBy: params.setBy,
      note: params.note,
    },
    { expiresAt: params.expiresAt }
  )
  return fromRecord(stored)
}
