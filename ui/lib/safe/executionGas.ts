import { TransactionOptions } from '@safe-global/safe-core-sdk-types'
import { ethers } from 'ethers'
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

const EXEC_TRANSACTION_IFACE = new ethers.utils.Interface([
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
])

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type SafeExecTxLike = {
  to?: string
  value?: string
  data?: string
  operation?: number
  safeTxGas?: string
  baseGas?: string
  gasPrice?: string
  gasToken?: string
  refundReceiver?: string
  confirmations?: Array<{ owner?: string; signature?: string }>
}

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

function packConfirmations(
  confirmations: Array<{ owner?: string; signature?: string }> | undefined
): string {
  const sorted = [...(confirmations ?? [])]
    .filter((c) => c.signature)
    .sort((a, b) =>
      (a.owner ?? '').toLowerCase().localeCompare((b.owner ?? '').toLowerCase())
    )
  return `0x${sorted.map((c) => (c.signature ?? '').replace(/^0x/i, '')).join('')}`
}

/** Encode Safe `execTransaction` from a Transaction Service payload. */
export function encodeExecTransactionData(safeTx: SafeExecTxLike): string {
  if (!safeTx.to) {
    throw new Error('Safe transaction is missing `to`')
  }
  return EXEC_TRANSACTION_IFACE.encodeFunctionData('execTransaction', [
    safeTx.to,
    safeTx.value ?? '0',
    safeTx.data || '0x',
    safeTx.operation ?? 0,
    safeTx.safeTxGas ?? '0',
    safeTx.baseGas ?? '0',
    safeTx.gasPrice ?? '0',
    safeTx.gasToken || ZERO_ADDRESS,
    safeTx.refundReceiver || ZERO_ADDRESS,
    packConfirmations(safeTx.confirmations),
  ])
}

async function encodeSafeExecCalldata(
  safe: {
    getEncodedTransaction?: (tx: unknown) => Promise<string>
  },
  safeTx: unknown
): Promise<string | null> {
  if (typeof safe.getEncodedTransaction === 'function') {
    try {
      const encoded = await safe.getEncodedTransaction(safeTx)
      if (encoded && encoded !== '0x') return encoded
    } catch {
      // API-kit payloads are not always a protocol-kit SafeTransaction.
    }
  }
  try {
    return encodeExecTransactionData(safeTx as SafeExecTxLike)
  } catch {
    return null
  }
}

export async function estimateSafeExecutionGas(params: {
  safe: {
    getAddress: () => Promise<string>
    getEncodedTransaction?: (tx: unknown) => Promise<string>
  }
  safeTx: unknown
  provider: {
    estimateGas: (tx: {
      to: string
      from?: string
      data: string
    }) => Promise<{ toString(): string }>
    getSigner?: () => { getAddress: () => Promise<string> }
  }
}): Promise<bigint | null> {
  try {
    const data = await encodeSafeExecCalldata(params.safe, params.safeTx)
    if (!data) return null
    const to = await params.safe.getAddress()
    const from = params.provider.getSigner
      ? await params.provider.getSigner().getAddress()
      : undefined
    const est = await params.provider.estimateGas({
      to,
      data,
      ...(from ? { from } : {}),
    })
    const value = BigInt(est.toString())
    return value > 0n ? value : null
  } catch {
    return null
  }
}

export async function resolveSafeExecutionOptions(params: {
  safe: {
    getAddress: () => Promise<string>
    getEncodedTransaction?: (tx: unknown) => Promise<string>
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
    estimateGas: (tx: {
      to: string
      from?: string
      data: string
    }) => Promise<{ toString(): string }>
    getSigner?: () => { getAddress: () => Promise<string> }
  }
}): Promise<TransactionOptions> {
  const [estimatedGas, fees] = await Promise.all([
    estimateSafeExecutionGas({
      safe: params.safe,
      safeTx: params.safeTx,
      provider: params.provider,
    }),
    resolveEip1559FeesFromProvider(params.provider),
  ])
  return buildSafeExecutionOptions({
    estimatedGas,
    isRejectionTx: params.isRejectionTx,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
}
