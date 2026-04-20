import dbConnect from '@/lib/mongodb/mongo'
import OperatorFlag from '@/lib/mongodb/models/OperatorFlag'

export const RETRO_CYCLE_OVERRIDE_KEY = 'retro_cycle_override'

export type RetroCycleOverride = {
  enabled: boolean
  setBy?: string
  note?: string
  setAt?: Date
  expiresAt?: Date | null
}

// Read the retro cycle override flag. Returns { enabled: false } if the flag
// is missing, expired, or MongoDB is unreachable (e.g. during local dev).
export async function getRetroCycleOverride(): Promise<RetroCycleOverride> {
  try {
    await dbConnect()
    const doc = await OperatorFlag.findOne({ key: RETRO_CYCLE_OVERRIDE_KEY })
    if (!doc) return { enabled: false }
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return { enabled: false }
    }
    return {
      enabled: !!doc.enabled,
      setBy: doc.setBy,
      note: doc.note,
      setAt: (doc as any).updatedAt,
      expiresAt: doc.expiresAt ?? null,
    }
  } catch (err) {
    console.error('getRetroCycleOverride failed:', err)
    return { enabled: false }
  }
}

export async function setRetroCycleOverride(params: {
  enabled: boolean
  setBy?: string
  note?: string
  expiresAt?: Date | null
}): Promise<RetroCycleOverride> {
  await dbConnect()
  const update: any = {
    enabled: params.enabled,
    setBy: params.setBy,
    note: params.note,
  }
  if (params.expiresAt === null) {
    update.expiresAt = undefined
  } else if (params.expiresAt) {
    update.expiresAt = params.expiresAt
  }
  const doc = await OperatorFlag.findOneAndUpdate(
    { key: RETRO_CYCLE_OVERRIDE_KEY },
    { $set: update },
    { upsert: true, new: true }
  )
  return {
    enabled: !!doc.enabled,
    setBy: doc.setBy,
    note: doc.note,
    setAt: (doc as any).updatedAt,
    expiresAt: doc.expiresAt ?? null,
  }
}
