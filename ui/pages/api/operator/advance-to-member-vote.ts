import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { setMemberVoteOverride } from '@/lib/operator/memberVote'
import { setSenateVoteOverride } from '@/lib/operator/senateVote'
import { getPrivyUserData } from '@/lib/privy'
import { authOptions } from '../auth/[...nextauth]'

// One-shot UI phase advance. The on-chain Proposals.tallyVotes(mdp) calls
// must be made separately by the contract owner (deployer EOA) — this route
// does NOT touch the chain. It only flips two Vercel KV flags so the
// projects UI rolls forward to the Member Vote phase:
//
//   senate_vote_disabled = true   (force IS_SENATE_VOTE off)
//   member_vote_enabled  = true   (force IS_MEMBER_VOTE on)
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let setBy: string | undefined
  try {
    const session = await getServerSession(req, res, authOptions)
    if (session?.accessToken) {
      const privyUserData = await getPrivyUserData(session.accessToken)
      setBy = privyUserData?.walletAddresses?.[0]
    }
  } catch (err) {
    console.warn('advance-to-member-vote: could not derive setBy address:', err)
  }

  const note = `Advanced senate -> member vote from operator panel${
    setBy ? ` (by ${setBy})` : ''
  }`

  try {
    const [senate, member] = await Promise.all([
      setSenateVoteOverride({ enabled: true, setBy, note }),
      setMemberVoteOverride({ enabled: true, setBy, note }),
    ])
    return res.status(200).json({
      success: true,
      flags: {
        senateVoteDisabled: senate,
        memberVoteEnabled: member,
      },
    })
  } catch (err: any) {
    console.error('advance-to-member-vote failed:', err)
    return res.status(500).json({
      error: err?.message || 'Failed to advance phase',
    })
  }
}

export default withMiddleware(handler, isOperator)
