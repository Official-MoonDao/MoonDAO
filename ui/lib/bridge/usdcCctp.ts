import { CCTP_V2, USDC_ADDRESSES, USDC_DECIMALS } from 'const/config'

/**
 * Ethereum → Arbitrum USDC via Circle CCTP V2 and the Forwarding Service.
 *
 * The burn happens on Ethereum. Circle attests it and submits the mint on
 * Arbitrum, so the user does not need ETH on Arbitrum. The minted token is
 * native USDC (`USDC_ADDRESSES.arbitrum`), which marketplace listings spend.
 */

export const BRIDGE_TOKENS = [
  { id: 'eth', label: 'ETH', icon: '/icons/networks/ethereum.svg' },
  { id: 'mooney', label: 'MOONEY', icon: '/Original.png' },
  { id: 'usdc', label: 'USDC', icon: '/coins/USDC.svg' },
] as const

export type BridgeTokenId = (typeof BRIDGE_TOKENS)[number]['id']

export type CctpForwardFeeLevel = 'low' | 'med' | 'high'

export type CctpFeeTier = {
  finalityThreshold: number
  minimumFeeBps: number
  forwardFee: Record<CctpForwardFeeLevel, bigint>
}

export type UsdcForwardQuote = {
  payAmount: bigint
  forwardFee: bigint
  protocolFee: bigint
  maxFee: bigint
  receiveAmount: bigint
}

export const USDC_BURN_WITH_HOOK_ABI = [
  'function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)',
]

const ZERO_BYTES32 = `0x${'0'.repeat(64)}`

export function cctpForwardFeeUrl(): string {
  return `${CCTP_V2.irisApi}/v2/burn/USDC/fees/${CCTP_V2.ethereumDomain}/${CCTP_V2.arbitrumDomain}?forward=true`
}

export async function fetchUsdcBridgeFee(): Promise<CctpFeeTier> {
  const response = await fetch('/api/bridge/usdc-fee', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('USDC bridge fee is unavailable')
  }
  const tier = selectFastForwardTier(await response.json())
  if (!tier) {
    throw new Error('USDC bridge fee is unavailable')
  }
  return tier
}

export function bridgeTokenById(id: BridgeTokenId) {
  const token = BRIDGE_TOKENS.find((item) => item.id === id)
  if (!token) {
    throw new Error(`Unknown bridge token ${id}`)
  }
  return token
}

function asNonNegativeUnits(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value)
  }
  return null
}

function parseFeeTier(item: unknown): CctpFeeTier | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const finalityThreshold = record.finalityThreshold
  const minimumFee = record.minimumFee
  const forwardFee = record.forwardFee
  if (typeof finalityThreshold !== 'number' || !Number.isFinite(finalityThreshold)) {
    return null
  }
  if (typeof minimumFee !== 'number' || !Number.isFinite(minimumFee) || minimumFee < 0) {
    return null
  }
  if (!forwardFee || typeof forwardFee !== 'object') return null
  const levels = forwardFee as Record<string, unknown>
  const low = asNonNegativeUnits(levels.low)
  const med = asNonNegativeUnits(levels.med)
  const high = asNonNegativeUnits(levels.high)
  if (low === null || med === null || high === null) return null
  return {
    finalityThreshold,
    minimumFeeBps: minimumFee,
    forwardFee: { low, med, high },
  }
}

/** Accepts Circle's fee array or the single fast-tier object our API returns. */
export function selectFastForwardTier(body: unknown): CctpFeeTier | null {
  const candidates = Array.isArray(body) ? body : [body]
  for (const candidate of candidates) {
    const tier = parseFeeTier(candidate)
    if (
      tier &&
      tier.finalityThreshold === CCTP_V2.fastFinalityThreshold &&
      tier.forwardFee.high > 0n
    ) {
      return tier
    }
  }
  return null
}

/**
 * Protocol fee in USDC units (6 decimals). `minimumFeeBps` is Circle's
 * basis-point rate (1 = 0.01%). Rounded up so `maxFee` cannot land under
 * the on-chain minimum. Unused headroom is refunded when the USDC is minted.
 */
export function protocolFeeUnits(amount: bigint, minimumFeeBps: number): bigint {
  if (amount <= 0n || !Number.isFinite(minimumFeeBps) || minimumFeeBps <= 0) {
    return 0n
  }
  const bpsHundredths = BigInt(Math.round(minimumFeeBps * 100))
  if (bpsHundredths <= 0n) return 0n
  const numerator = amount * bpsHundredths
  return (numerator + 999_999n) / 1_000_000n
}

/**
 * Quote a burn of `payAmount`. The fee is taken out of that amount on
 * Arbitrum. Returns null when the amount cannot cover the fee: CCTP reverts
 * if `maxFee` is greater than or equal to `amount`.
 */
export function quoteUsdcForwardBurn(
  payAmount: bigint,
  tier: CctpFeeTier,
  level: CctpForwardFeeLevel = 'high'
): UsdcForwardQuote | null {
  const forwardFee = tier.forwardFee[level]
  const protocolFee = protocolFeeUnits(payAmount, tier.minimumFeeBps)
  const maxFee = forwardFee + protocolFee
  if (payAmount <= 0n || maxFee <= 0n || maxFee >= payAmount) return null
  return {
    payAmount,
    forwardFee,
    protocolFee,
    maxFee,
    receiveAmount: payAmount - maxFee,
  }
}

/** Floor a user-entered decimal to 6 USDC places. Rejects anything that is not a plain decimal. */
export function parseUsdcUnits(amount: string): bigint | null {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d*)?$/.test(trimmed)) return null
  const [whole, frac = ''] = trimmed.split('.')
  const frac6 = (frac + '000000').slice(0, USDC_DECIMALS)
  return BigInt(whole) * 1_000_000n + BigInt(frac6)
}

export function formatUsdcUnits(units: bigint): string {
  const negative = units < 0n
  const abs = negative ? -units : units
  const whole = abs / 1_000_000n
  const frac = (abs % 1_000_000n).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  const text = frac.length > 0 ? `${whole.toString()}.${frac}` : whole.toString()
  return negative ? `-${text}` : text
}

export function addressToBytes32(address: string): string {
  const cleaned = address.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(cleaned)) {
    throw new Error('Invalid mint recipient')
  }
  return `0x${cleaned.slice(2).padStart(64, '0')}`
}

export function buildUsdcBurnCall(params: {
  payAmount: bigint
  maxFee: bigint
  recipient: string
}) {
  return {
    tokenMessenger: CCTP_V2.tokenMessenger,
    burnToken: USDC_ADDRESSES.ethereum,
    destinationUsdc: USDC_ADDRESSES.arbitrum,
    args: [
      params.payAmount.toString(),
      CCTP_V2.arbitrumDomain,
      addressToBytes32(params.recipient),
      USDC_ADDRESSES.ethereum,
      ZERO_BYTES32,
      params.maxFee.toString(),
      CCTP_V2.fastFinalityThreshold,
      CCTP_V2.forwardHookData,
    ] as const,
  }
}
