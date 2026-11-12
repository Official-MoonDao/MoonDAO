import { Redis } from '@upstash/redis'
import { FORECASTS_TABLE_ADDRESSES } from 'const/config'
import { providers } from 'ethers'
import { guestAuthMiddleware } from 'middleware/authMiddleware'
import { getTrustedClientIp, rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  FORECAST_GAS_SPONSOR_TTL_SECONDS,
  FORECAST_GAS_SPONSORSHIPS_PER_DAY,
  forecastGasBudgetWei,
  forecastGasSponsorKey,
  forecastGasTopUpWei,
  forecastGuestDailyCapWei,
  forecastGuestDay,
  forecastGuestIpKey,
  forecastGuestSpendKey,
  guestGasCheck,
  type GuestGasCheck,
} from '@/lib/deprize/forecastGas'
import { sessionWallet } from '@/lib/deprize/sessionWallet'
import { hsmRpcForChain, isHSMAvailable, sendEthFromHSM } from '@/lib/google/hsm-signer'
import { jsonRpcWithFallback } from '@/lib/rpc/serverJsonRpc'
import { getChainById, getChainSlug } from '@/lib/thirdweb/chain'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

/** Daily cap. A dead counter must not block the stipend. */
async function reserveForecastGasSlot(
  chainId: number,
  wallet: string
): Promise<'ok' | 'capped' | 'unchecked'> {
  const key = forecastGasSponsorKey(chainId, wallet)
  try {
    const used = await redis.incr(key)
    if (used === 1) await redis.expire(key, FORECAST_GAS_SPONSOR_TTL_SECONDS)
    if (used > FORECAST_GAS_SPONSORSHIPS_PER_DAY) return 'capped'
    return 'ok'
  } catch (err) {
    console.error('[deprize] forecast gas rate limit unavailable', err)
    return 'unchecked'
  }
}

async function releaseForecastGasSlot(chainId: number, wallet: string) {
  try {
    await redis.decr(forecastGasSponsorKey(chainId, wallet))
  } catch {
    // The counter was already unreachable, or this release lost the race.
  }
}

type GuestReservation = { ipKey: string; spendKey: string; wei: bigint }

/**
 * Guests are free to create, so unlike the per-wallet counter this fails
 * closed: no counter, no stipend.
 */
async function reserveGuestGas(
  chainId: number,
  ip: string,
  wei: bigint
): Promise<GuestGasCheck | 'unavailable' | GuestReservation> {
  const day = forecastGuestDay(new Date())
  const ipKey = forecastGuestIpKey(chainId, ip, day)
  const spendKey = forecastGuestSpendKey(chainId, day)
  try {
    const ipCount = await redis.incr(ipKey)
    if (ipCount === 1) await redis.expire(ipKey, FORECAST_GAS_SPONSOR_TTL_SECONDS)
    const spent = await redis.incrby(spendKey, Number(wei))
    if (spent === Number(wei)) await redis.expire(spendKey, 2 * FORECAST_GAS_SPONSOR_TTL_SECONDS)
    const check = guestGasCheck({
      ipCount,
      spentWei: BigInt(spent),
      capWei: forecastGuestDailyCapWei(chainId, process.env.FORECAST_GUEST_DAILY_CAP_WEI),
    })
    if (check !== 'ok') {
      await releaseGuestGas({ ipKey, spendKey, wei })
      return check
    }
    return { ipKey, spendKey, wei }
  } catch (err) {
    console.error('[deprize] guest forecast gas counter unavailable', err)
    return 'unavailable'
  }
}

async function releaseGuestGas(reservation: GuestReservation) {
  try {
    await Promise.all([
      redis.decr(reservation.ipKey),
      redis.decrby(reservation.spendKey, Number(reservation.wei)),
    ])
  } catch {
    // The counter was already unreachable, or this release lost the race.
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const claimedWallet = typeof req.body?.wallet === 'string' ? req.body.wallet.trim() : ''
  const caller = await sessionWallet(req, res, claimedWallet, { allowGuest: true })
  const wallet = caller?.wallet ?? null
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
  // before the HSM gate so a funded prediction still proceeds when this
  // server has no signer.
  let rpc: string
  try {
    rpc = hsmRpcForChain(chainId)
  } catch {
    return res.status(400).json({
      sponsored: false,
      message: 'Predictions are not available on this network yet.',
    })
  }

  let balance: bigint
  try {
    const raw = await jsonRpcWithFallback(chainId, 'eth_getBalance', [wallet, 'latest'], {
      timeoutMs: 5_000,
    }).catch(async () => {
      const b = await new providers.StaticJsonRpcProvider(rpc, chainId).getBalance(wallet)
      return b.toString()
    })
    balance = BigInt(raw)
  } catch (err) {
    console.error('[deprize] forecast gas balance read failed', err)
    return res.status(503).json({
      sponsored: false,
      message: 'Could not check your gas balance. Try again.',
    })
  }
  const topUp = forecastGasTopUpWei(balance, forecastGasBudgetWei(chainId))
  if (topUp <= 0n) {
    return res.status(200).json({ sponsored: false, funded: true })
  }

  // Anyone with a wallet can predict. A non-Citizen vote is stored at 0 voting
  // power, so it does not move the MOONEY outcome. Gas is still sponsored so a
  // new wallet can cast that vote.
  if (!isHSMAvailable()) {
    return res.status(503).json({
      sponsored: false,
      message: 'Gas sponsorship is not configured on this server.',
    })
  }

  const slot = await reserveForecastGasSlot(chainId, wallet)
  if (slot === 'capped') {
    return res.status(429).json({
      sponsored: false,
      message:
        'Gas sponsorship for predictions is used up for today. Add a little ETH for gas and try again.',
    })
  }

  let guest: GuestReservation | null = null
  if (caller?.isGuest) {
    const reserved = await reserveGuestGas(chainId, getTrustedClientIp(req), topUp)
    if (typeof reserved === 'string') {
      if (slot === 'ok') await releaseForecastGasSlot(chainId, wallet)
      return res.status(reserved === 'unavailable' ? 503 : 429).json({
        sponsored: false,
        guestLimited: true,
        message:
          reserved === 'unavailable'
            ? 'Could not cover gas for this prediction. Try again.'
            : 'Free predictions without an account are paused for today. Sign in to predict.',
      })
    }
    guest = reserved
  }

  try {
    const txHash = await sendEthFromHSM(wallet, topUp, chainId)
    return res.status(200).json({ sponsored: true, txHash })
  } catch (err) {
    if (slot === 'ok') await releaseForecastGasSlot(chainId, wallet)
    if (guest) await releaseGuestGas(guest)
    console.error('[deprize] forecast gas sponsorship failed', err)
    return res.status(503).json({
      sponsored: false,
      message: 'Could not cover gas for this prediction. Try again.',
    })
  }
}

export default withMiddleware(handler, guestAuthMiddleware, rateLimit)
