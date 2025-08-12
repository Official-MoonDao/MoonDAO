import { utils as ethersUtils } from 'ethers'
import { gql, request as gqlRequest } from 'graphql-request'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  signHasVotingPowerProof,
  submitHasVotingPowerClaimFor,
} from '../../../lib/oracle'

const MIN_VOTING_POWER = BigInt(1)

type Address = `0x${string}`

async function fetchSnapshotVP(user: Address, space: string): Promise<bigint> {
  const endpoint = 'https://hub.snapshot.org/graphql'
  const query = gql`
  {
    vp (voter: "${user}", space: "tomoondao.eth") {
      vp
    }
  }`
  try {
    const data = (await gqlRequest(endpoint, query, {
      voter: user,
      space,
    })) as any
    const value = Number(data?.vp?.vp ?? 0)
    const floored = Number.isFinite(value) ? Math.floor(value) : 0
    return BigInt(floored)
  } catch (err) {
    // Snapshot sometimes returns provider errors; treat as 0 VP rather than 500
    console.error('Snapshot VP fetch failed:', err)
    return BigInt(0)
  }
}

function chooseXpAmount(vp: bigint): bigint {
  if (vp >= BigInt('100000')) return BigInt('200')
  if (vp >= BigInt('50000')) return BigInt('100')
  if (vp >= BigInt('10000')) return BigInt('50')
  if (vp >= BigInt('5000')) return BigInt('25')
  if (vp >= BigInt('0')) return BigInt('10')
  return BigInt(0)
}

// Route uses shared oracle helper; no env handling here

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user } = JSON.parse(req.body) as { user?: string }
    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    // Compute VP locally (Snapshot logic kept here)
    const SNAPSHOT_SPACE = process.env.SNAPSHOT_SPACE || 'tomoondao.eth'
    const vp = await fetchSnapshotVP(user as Address, SNAPSHOT_SPACE)
    if (vp < MIN_VOTING_POWER)
      return res.status(200).json({ eligible: false, vp: vp.toString() })

    // Choose XP amount locally (your current tiering)
    const xpAmount = chooseXpAmount(vp)
    if (xpAmount === BigInt(0))
      return res.status(200).json({ eligible: false, vp: vp.toString() })

    // Sign/encode via shared oracle helper
    const { validAfter, validBefore, signature, context } =
      await signHasVotingPowerProof({
        user: user as Address,
        minVotingPower: MIN_VOTING_POWER,
        xpAmount,
      })

    // Relay the XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasVotingPowerClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      vp: vp.toString(),
      xpAmount: xpAmount.toString(),
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      signature,
      context,
      txHash,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
