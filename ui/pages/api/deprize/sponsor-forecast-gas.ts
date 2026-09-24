import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { Redis } from '@upstash/redis'
import { providers } from 'ethers'
import type { NextApiRequest, NextApiResponse } from 'next'
import { FORECASTS_TABLE_ADDRESSES } from 'const/config'
import { probeCitizen } from '@/lib/citizen/probeCitizen'
import {
  FORECAST_GAS_SPONSOR_TTL_SECONDS,
  FORECAST_GAS_SPONSORSHIPS_PER_DAY,
  forecastGasBudgetWei,
  forecastGasSponsorKey,
  forecastGasTopUpWei,
} from '@/lib/deprize/forecastGas'
import { walletFromSession } from '@/lib/deprize/sessionWallet'
import { hsmRpcForChain, isHSMAvailable, sendEthFromHSM } from '@/lib/google/hsm-signer'
import { getChainById, getChainSlug } from '@/lib/thirdweb/chain'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claimedWallet = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''
  const wallet = await walletFromSession(req, res, claimedWallet)
  const chainId = Number(req.body?.chainId)
  const deprizeId = Number(req.body?.deprizeId)

  if (!wallet) {
    return res.status(400).json({
      sponsored: false,
      message: 'Connect a valid wallet to predict.',
    })
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return res.status(400).json({ sponsored: false, message: 'Invalid chain.' })
  }
  if (!Number.isInteger(deprizeId) || deprizeId < 0) {
    return res.status(400).json({ sponsored: false, message: 'Invalid prize.' })
  }

  const chain = getChainById(chainId)
  const table = chain ? FORECASTS_TABLE_ADDRESSES[getChainSlug(chain)] : ''
  if (!chain || !table) {
    return res.status(400).json({
      sponsored: false,
      message: 'Predictions are not available on this network yet.',
    })
  }

  // A wallet that already covers gas does not need a stipend. Check that
  // before the Citizen probe and HSM gate so a funded prediction still
  // proceeds when the probe blips or this server has no signer.
  let rpc: string
  try {
    rpc = hsmRpcForChain(chainId)
  } catch {
    return res.status(400).json({
      sponsored: false,
      message: 'Predictions are not available on this network yet.',
    })
  }

  const balance = await new providers.JsonRpcProvider(rpc).getBalance(wallet)
  const topUp = forecastGasTopUpWei(BigInt(balance.toString()), forecastGasBudgetWei(chainId))
  if (topUp <= 0n) {
    return res.status(200).json({ sponsored: false, funded: true })
  }

  // A lookup blip is not "not a Citizen." Funded wallets already skipped
  // this probe; an underfunded Citizen should retry, not be told to mint.
  const citizen = await probeCitizen(chain, wallet)
  if (citizen.status === 'error') {
    return res.status(503).json({
      sponsored: false,
      message: "Couldn't check your Citizen. Try again.",
    })
  }
  if (citizen.status === 'expired') {
    return res.status(403).json({
      sponsored: false,
      message: 'Your Citizen subscription has lapsed.',
    })
  }
  if (citizen.status !== 'citizen') {
    return res.status(403).json({
      sponsored: false,
      message: 'Predictions count only for Citizens.',
    })
  }

  if (!isHSMAvailable()) {
    return res.status(503).json({
      sponsored: false,
      message: 'Gas sponsorship is not configured on this server.',
    })
  }

  const key = forecastGasSponsorKey(chainId, wallet)
  const used = await redis.incr(key)
  if (used === 1) await redis.expire(key, FORECAST_GAS_SPONSOR_TTL_SECONDS)
  if (used > FORECAST_GAS_SPONSORSHIPS_PER_DAY) {
    return res.status(429).json({
      sponsored: false,
      message: 'Gas sponsorship for predictions is used up for today. Add a little ETH for gas and try again.',
    })
  }

  try {
    const txHash = await sendEthFromHSM(wallet, topUp, chainId)
    return res.status(200).json({ sponsored: true, txHash })
  } catch (err) {
    await redis.decr(key).catch(() => undefined)
    console.error('[deprize] forecast gas sponsorship failed', err)
    return res.status(503).json({
      sponsored: false,
      message: 'Could not cover gas for this prediction. Try again.',
    })
  }
}

export default withMiddleware(handler, authMiddleware, rateLimit)
