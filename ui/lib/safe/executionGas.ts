import { TransactionOptions } from '@safe-global/safe-core-sdk-types'
import { resolveEip1559FeesFromProvider } from '@/lib/rpc/eip1559Fees'

/**
 * Project Safe `execTransaction` typically lands in the 150–400k gas range.
 * Hardcoding 2M/3M made nodes demand `gasLimit * maxFee` of ~0.00012 ETH on
 * Arbitrum at ~0.02 gwei — more than many Privy / project-signer balances.
 */
const FALLBACK_GAS_LIMIT = 500_000n
const REJECTION_FALLBACK_GAS_LIMIT = 750_000n
const MAX_GAS_LIMIT = 1_500_000n
const REJECTION_MAX_GAS_LIMIT = 2_000_000n
const MIN_GAS_LIMIT = 150_000n
const ESTIMATE_BUFFER_BPS = 150n

export function resolveSafeExecutionGasLimit(params: {
  estimatedGas?: bigint | null
  isRejectionTx: boolean
}): bigint {
  const fallback = params.isRejectionTx
    ? REJECTION_FALLBACK_GAS_LIMIT
    : FALLBACK_GAS_LIMIT
  const cap = params.isRejectionTx ? REJECTION_MAX_GAS_LIMIT : MAX_GAS_LIMIT
  const estimated = params.estimatedGas
  if (estimated == null || estimated <= 0n) return fallback

  const buffered = (estimated * ESTIMATE_BUFFER_BPS) / 100n
  if (buffered < MIN_GAS_LIMIT) return MIN_GAS_LIMIT
  if (buffered > cap) return cap
  return buffered
}

export function buildSafeExecutionOptions(params: {
  estimatedGas?: bigint | null
  isRejectionTx: boolean
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}): TransactionOptions {
  return {
    gasLimit: resolveSafeExecutionGasLimit(params).toString(),
    maxFeePerGas: params.maxFeePerGas.toString(),
    maxPriorityFeePerGas: params.maxPriorityFeePerGas.toString(),
  }
}

export async function estimateSafeExecutionGas(
  safe: {
    estimateGas?: (tx: unknown) => Promise<unknown>
    getEstimatedGas?: (tx: unknown) => Promise<unknown>
  },
  safeTx: unknown
): Promise<bigint | null> {
  const estimator = safe.getEstimatedGas ?? safe.estimateGas
  if (!estimator) return null
  try {
    const est = await estimator.call(safe, safeTx)
    if (est == null) return null
    const value = BigInt(est.toString())
    return value > 0n ? value : null
  } catch {
    return null
  }
}

export async function resolveSafeExecutionOptions(params: {
  safe: {
    estimateGas?: (tx: unknown) => Promise<unknown>
    getEstimatedGas?: (tx: unknown) => Promise<unknown>
  }
  safeTx: unknown
  isRejectionTx: boolean
  provider: {
    getFeeData: () => Promise<{
      maxFeePerGas?: { toString(): string } | null
      maxPriorityFeePerGas?: { toString(): string } | null
      gasPrice?: { toString(): string } | null
    }>
    getBlock: (tag: string) => Promise<{
      baseFeePerGas?: { toString(): string } | null
    } | null>
  }
}): Promise<TransactionOptions> {
  const [estimatedGas, fees] = await Promise.all([
    estimateSafeExecutionGas(params.safe, params.safeTx),
    resolveEip1559FeesFromProvider(params.provider),
  ])
  return buildSafeExecutionOptions({
    estimatedGas,
    isRejectionTx: params.isRejectionTx,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
}
