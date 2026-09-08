/**
 * Shared EIP-1559 fee math.
 *
 * Wallet providers (Privy embedded, some RPCs) return inflated `getFeeData()`
 * values. We compute maxFee from the block base fee instead: 2.4× base +
 * priority, matching `/api/rpc/gas-price` and the contribute-modal budget.
 */

export const MAX_FEE_BASE_MULTIPLIER_BPS = 240n

export function computeMaxFeePerGas(
  baseFeePerGas: bigint,
  maxPriorityFeePerGas: bigint
): bigint {
  return (
    (baseFeePerGas * MAX_FEE_BASE_MULTIPLIER_BPS) / 100n + maxPriorityFeePerGas
  )
}

export type Eip1559FeeOverrides = {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

type FeeLike = { toString(): string } | null | undefined

export type FeeDataLike = {
  maxFeePerGas?: FeeLike
  maxPriorityFeePerGas?: FeeLike
  gasPrice?: FeeLike
}

export type BlockLike = {
  baseFeePerGas?: FeeLike
} | null

function toBigInt(value: FeeLike): bigint {
  if (value == null) return 0n
  return BigInt(value.toString())
}

export function feesFromBaseAndPriority(
  baseFeePerGas: bigint,
  maxPriorityFeePerGas: bigint,
  fallbackMaxFeePerGas = 0n
): Eip1559FeeOverrides {
  if (baseFeePerGas > 0n) {
    return {
      maxFeePerGas: computeMaxFeePerGas(baseFeePerGas, maxPriorityFeePerGas),
      maxPriorityFeePerGas,
    }
  }
  return {
    maxFeePerGas: fallbackMaxFeePerGas,
    maxPriorityFeePerGas,
  }
}

export function feesFromProviderSnapshot(
  fee: FeeDataLike,
  block: BlockLike
): Eip1559FeeOverrides {
  const priority = toBigInt(fee.maxPriorityFeePerGas)
  const baseFee = toBigInt(block?.baseFeePerGas)
  const fallback = toBigInt(fee.maxFeePerGas) || toBigInt(fee.gasPrice)
  return feesFromBaseAndPriority(baseFee, priority, fallback)
}

export async function resolveEip1559FeesFromProvider(provider: {
  getFeeData: () => Promise<FeeDataLike>
  getBlock: (tag: string) => Promise<BlockLike>
}): Promise<Eip1559FeeOverrides> {
  const [fee, block] = await Promise.all([
    provider.getFeeData(),
    provider.getBlock('latest'),
  ])
  return feesFromProviderSnapshot(fee, block)
}

export function parseOptionalHexBigInt(value: unknown): bigint | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

/**
 * `0n` is a valid Arbitrum tip. Treat only `undefined` as missing so we still
 * emit / consume fee fields when `eth_maxPriorityFeePerGas` returns 0.
 */
export function hasFeeValue(value: bigint | undefined): value is bigint {
  return value !== undefined
}

export function parseGasPriceApiPayload(
  data: Record<string, unknown> | null | undefined
): Eip1559FeeOverrides | null {
  if (!data) return null
  const priority = parseOptionalHexBigInt(data.maxPriorityFeePerGas) ?? 0n
  const maxFee = parseOptionalHexBigInt(data.maxFeePerGas)
  if (maxFee !== undefined && maxFee > 0n) {
    return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priority }
  }
  // Recover when the API omitted maxFee/priority because 0n is falsy.
  const baseFee = parseOptionalHexBigInt(data.baseFeePerGas)
  if (baseFee !== undefined && baseFee > 0n) {
    return {
      maxFeePerGas: computeMaxFeePerGas(baseFee, priority),
      maxPriorityFeePerGas: priority,
    }
  }
  return null
}

export async function fetchClientFeeOverrides(
  chainId: number
): Promise<Eip1559FeeOverrides | null> {
  const response = await fetch(`/api/rpc/gas-price?chainId=${chainId}`)
  if (!response.ok) return null
  const data = await response.json()
  return parseGasPriceApiPayload(data)
}

export function applyFeeOverrides<T extends Record<string, unknown>>(
  tx: T,
  fees: Eip1559FeeOverrides
): T {
  return {
    ...tx,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  }
}

export async function withClientFeeOverrides<T extends Record<string, unknown>>(
  tx: T,
  chainId: number
): Promise<T> {
  try {
    const fees = await fetchClientFeeOverrides(chainId)
    if (!fees) return tx
    return applyFeeOverrides(tx, fees)
  } catch {
    return tx
  }
}
