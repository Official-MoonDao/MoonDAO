import { ethers } from 'ethers'
import { isHexAddress } from './eligibility'

/**
 * MoonDAO-run forecasting agents that bet from labeled wallets. They cannot
 * make the public bettor attestations (they are MoonDAO's own wallets), so
 * they never use /api/deprize/permit. /api/deprize/agent-permit issues their
 * permits instead: the wallet must be listed in DEPRIZE_HOUSE_AGENT_WALLETS
 * (comma-separated) and must sign a fresh request. Sanctions screening still
 * runs, and every permit is logged with eligibilityReason 'house-agent'.
 */

export const HOUSE_AGENT_REQUEST_MAX_AGE_MS = 2 * 60 * 1000
export const HOUSE_AGENT_REQUEST_MAX_SKEW_MS = 30 * 1000

export function houseAgentWallets(): string[] {
  return (process.env.DEPRIZE_HOUSE_AGENT_WALLETS || '')
    .split(',')
    .map((part) => part.trim())
    .filter(isHexAddress)
    .map((addr) => addr.toLowerCase())
}

export function isHouseAgentWallet(wallet: string): boolean {
  return isHexAddress(wallet) && houseAgentWallets().includes(wallet.toLowerCase())
}

export function houseAgentPermitMessage(args: {
  wallet: string
  deprizeId: number
  chainId: number
  issuedAt: number
}): string {
  return [
    'MoonDAO DePrize house agent permit request',
    `wallet: ${args.wallet.toLowerCase()}`,
    `deprizeId: ${args.deprizeId}`,
    `chainId: ${args.chainId}`,
    `issuedAt: ${args.issuedAt}`,
  ].join('\n')
}

export type HouseAgentRequest = {
  wallet: string
  deprizeId: number
  chainId: number
  issuedAt: number
}

export type HouseAgentCheck =
  | { ok: true; request: HouseAgentRequest }
  | { ok: false; status: number; error: string }

export function verifyHouseAgentRequest(body: unknown, nowMs: number): HouseAgentCheck {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const wallet = typeof raw.wallet === 'string' ? raw.wallet.trim() : ''
  const deprizeId = Number(raw.deprizeId)
  const chainId = Number(raw.chainId)
  const issuedAt = Number(raw.issuedAt)
  const signature = typeof raw.signature === 'string' ? raw.signature.trim() : ''

  if (!isHexAddress(wallet)) return { ok: false, status: 400, error: 'Invalid wallet' }
  if (!Number.isInteger(deprizeId) || deprizeId < 0) return { ok: false, status: 400, error: 'Invalid deprizeId' }
  if (!Number.isInteger(chainId) || chainId <= 0) return { ok: false, status: 400, error: 'Invalid chainId' }
  if (!Number.isInteger(issuedAt)) return { ok: false, status: 400, error: 'Invalid issuedAt' }
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return { ok: false, status: 400, error: 'Invalid signature' }
  if (!isHouseAgentWallet(wallet)) return { ok: false, status: 403, error: 'Not a house agent wallet' }
  if (issuedAt > nowMs + HOUSE_AGENT_REQUEST_MAX_SKEW_MS || nowMs - issuedAt > HOUSE_AGENT_REQUEST_MAX_AGE_MS) {
    return { ok: false, status: 401, error: 'Request expired' }
  }

  const request = { wallet: wallet.toLowerCase(), deprizeId, chainId, issuedAt }
  let recovered = ''
  try {
    recovered = ethers.utils.verifyMessage(houseAgentPermitMessage(request), signature)
  } catch {
    return { ok: false, status: 401, error: 'Invalid signature' }
  }
  if (recovered.toLowerCase() !== request.wallet) {
    return { ok: false, status: 401, error: 'Signature does not match wallet' }
  }
  return { ok: true, request }
}
