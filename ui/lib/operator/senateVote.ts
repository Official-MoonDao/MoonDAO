import dbConnect from '@/lib/mongodb/mongo'
import OperatorFlag from '@/lib/mongodb/models/OperatorFlag'

export const SENATE_VOTE_DISABLED_KEY = 'senate_vote_disabled'

// Force-OFF override for IS_SENATE_VOTE. The base config flag in
// `const/config.ts` is the source of truth; this lets operators end the
// senate-vote phase early without a deploy. If `enabled` is true, treat
// `IS_SENATE_VOTE` as false everywhere it's read.
export type SenateVoteOverride = {
  enabled: boolean
  setBy?: string
  note?: string
  setAt?: Date
  expiresAt?: Date | null
}

export async function getSenateVoteOverride(): Promise<SenateVoteOverride> {
  try {
    await dbConnect()
    const doc = await OperatorFlag.findOne({ key: SENATE_VOTE_DISABLED_KEY })
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
    console.error('getSenateVoteOverride failed:', err)
    return { enabled: false }
  }
}

export async function setSenateVoteOverride(params: {
  enabled: boolean
  setBy?: string
  note?: string
  expiresAt?: Date | null
}): Promise<SenateVoteOverride> {
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
    { key: SENATE_VOTE_DISABLED_KEY },
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
