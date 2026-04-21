import {
  OperatorFlagRecord,
  readOperatorFlag,
  writeOperatorFlag,
} from '@/lib/operator/kv'

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

type StoredSenateVoteOverride = OperatorFlagRecord<{}>

function fromRecord(rec: StoredSenateVoteOverride | null): SenateVoteOverride {
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

export async function getSenateVoteOverride(): Promise<SenateVoteOverride> {
  const rec = await readOperatorFlag<StoredSenateVoteOverride>(
    SENATE_VOTE_DISABLED_KEY
  )
  return fromRecord(rec)
}

export async function setSenateVoteOverride(params: {
  enabled: boolean
  setBy?: string
  note?: string
  expiresAt?: Date | null
}): Promise<SenateVoteOverride> {
  const stored = await writeOperatorFlag<StoredSenateVoteOverride>(
    SENATE_VOTE_DISABLED_KEY,
    {
      enabled: params.enabled,
      setBy: params.setBy,
      note: params.note,
    },
    { expiresAt: params.expiresAt }
  )
  return fromRecord(stored)
}
