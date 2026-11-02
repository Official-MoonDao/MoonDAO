import { Redis } from '@upstash/redis'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { providers } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { probeCitizen } from '@/lib/citizen/probeCitizen'
import {
  CONTRIBUTION_GAS_SPONSOR_TTL_SECONDS,
  CONTRIBUTION_GAS_SPONSORSHIPS_PER_DAY,
  contributionGasBudgetWei,
  contributionGasSponsorKey,
  contributionGasTopUpWei,
} from '@/lib/contributions/contributionGas'
import { contributionsTable } from '@/lib/contributions/onchain'
import { walletFromSession } from '@/lib/deprize/sessionWallet'
import { hsmRpcForChain, isHSMAvailable, sendEthFromHSM } from '@/lib/google/hsm-signer'
import { getChainSlug } from '@/lib/thirdweb/chain'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

/** Daily cap. A dead counter must not block a submission. */
async function reserveSlot(
  chainId: number,
  wallet: string
): Promise<'ok' | 'capped' | 'unchecked'> {
  const key = contributionGasSponsorKey(chainId, wallet)
  try {
    const used = await redis.incr(key)
    if (used === 1) await redis.expire(key, CONTRIBUTION_GAS_SPONSOR_TTL_SECONDS)
    if (used > CONTRIBUTION_GAS_SPONSORSHIPS_PER_DAY) return 'capped'
    return 'ok'
  } catch (err) {
    console.error('[contributions] gas rate limit unavailable', err)
    return 'unchecked'
  }
}

async function releaseSlot(chainId: number, wallet: string) {
  try {
    await redis.decr(contributionGasSponsorKey(chainId, wallet))
  } catch {
    // The counter was already unreachable, or this release lost the race.
  }
}

// Tops up a Citizen's wallet so a Privy embedded wallet with no ETH can sign
// `Contributions.submit`. Only the default chain, and only for a wallet that
// holds an unexpired Citizen, since the contract would revert for anyone else.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claimedWallet = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''
  const wallet = await walletFromSession(req, res, claimedWallet)
  if (!wallet) {
    return res.status(400).json({ sponsored: false, message: 'Connect your wallet to submit.' })
  }

  const chain = DEFAULT_CHAIN_V5
  const chainId = chain.id
  if (Number(req.body?.chainId) !== chainId || !contributionsTable(getChainSlug(chain))) {
    return res.status(400).json({
      sponsored: false,
      message: 'Contributions are not available on this network yet.',
    })
  }

  // Check the balance before the Citizen and HSM gates, so a funded wallet
  // proceeds even when this server has no signer.
  let balance
  try {
    balance = await new providers.JsonRpcProvider(hsmRpcForChain(chainId)).getBalance(wallet)
  } catch (err) {
    console.error('[contributions] gas balance read failed', err)
    return res.status(503).json({
      sponsored: false,
      message: 'Could not check your gas balance. Try again.',
    })
  }
  const topUp = contributionGasTopUpWei(
    BigInt(balance.toString()),
    contributionGasBudgetWei(chainId)
  )
  if (topUp <= 0n) {
    return res.status(200).json({ sponsored: false, funded: true })
  }

  const citizen = await probeCitizen(chain, wallet)
  if (citizen.status !== 'citizen') {
    return res.status(403).json({
      sponsored: false,
      message:
        citizen.status === 'error'
          ? 'Could not confirm your Citizenship. Try again.'
          : 'Only Citizens can submit contributions.',
    })
  }

  if (!isHSMAvailable()) {
    return res.status(503).json({
      sponsored: false,
      message: 'Gas sponsorship is not configured on this server.',
    })
  }

  const slot = await reserveSlot(chainId, wallet)
  if (slot === 'capped') {
    return res.status(429).json({
      sponsored: false,
      message: 'Gas sponsorship is used up for today. Add a little ETH for gas and try again.',
    })
  }

  try {
    const txHash = await sendEthFromHSM(wallet, topUp, chainId)
    return res.status(200).json({ sponsored: true, txHash })
  } catch (err) {
    if (slot === 'ok') await releaseSlot(chainId, wallet)
    console.error('[contributions] gas sponsorship failed', err)
    return res.status(503).json({
      sponsored: false,
      message: 'Could not cover gas for this submission. Try again.',
    })
  }
}

export default withMiddleware(handler, authMiddleware, rateLimit)
