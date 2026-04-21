import {
  OperatorFlagRecord,
  readOperatorFlag,
  writeOperatorFlag,
} from '@/lib/operator/kv'

export const MEMBER_VOTE_ENABLED_KEY = 'member_vote_enabled'

// Force-ON override for IS_MEMBER_VOTE. The base config flag in
// `const/config.ts` is the source of truth; this lets operators open the
// member-vote phase early without a deploy. If `enabled` is true, treat
// `IS_MEMBER_VOTE` as true everywhere it's read.
export type MemberVoteOverride = {
  enabled: boolean
  setBy?: string
  note?: string
  setAt?: Date
  expiresAt?: Date | null
}

type StoredMemberVoteOverride = OperatorFlagRecord<{}>

function fromRecord(rec: StoredMemberVoteOverride | null): MemberVoteOverride {
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

export async function getMemberVoteOverride(): Promise<MemberVoteOverride> {
  const rec = await readOperatorFlag<StoredMemberVoteOverride>(
    MEMBER_VOTE_ENABLED_KEY
  )
  return fromRecord(rec)
}

export async function setMemberVoteOverride(params: {
  enabled: boolean
  setBy?: string
  note?: string
  expiresAt?: Date | null
}): Promise<MemberVoteOverride> {
  const stored = await writeOperatorFlag<StoredMemberVoteOverride>(
    MEMBER_VOTE_ENABLED_KEY,
    {
      enabled: params.enabled,
      setBy: params.setBy,
      note: params.note,
    },
    { expiresAt: params.expiresAt }
  )
  return fromRecord(stored)
}
