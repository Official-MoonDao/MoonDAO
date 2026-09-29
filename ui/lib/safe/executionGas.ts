import { TransactionOptions } from '@safe-global/safe-core-sdk-types'
import { ethers } from 'ethers'
import {
  Eip1559FeeOverrides,
  feesFromProviderSnapshot,
  parseOptionalHexBigInt,
  resolveEip1559FeesFromProvider,
} from '@/lib/rpc/eip1559Fees'

/**
 * Project Safe `execTransaction` on Ethereum is often 150–400k gas.
 * Arbitrum is different: a token transfer lands around 120k gas at ~0.02 gwei,
 * and `eth_estimateGas` is already the limit the chain wants. Padding that
 * estimate by 1.5× and pricing it at 2.4× base plus the wallet's Ethereum tip
 * is what the wallet shows as a huge "site suggested" max fee.
 */
const FALLBACK_GAS_LIMIT = 500_000n
const REJECTION_FALLBACK_GAS_LIMIT = 750_000n
const MAX_GAS_LIMIT = 1_500_000n
const REJECTION_MAX_GAS_LIMIT = 2_000_000n
const MIN_GAS_LIMIT = 150_000n
const ESTIMATE_BUFFER_BPS = 150n
/** Arbitrum's own estimate already includes headroom. 10% covers the gap we see on-chain. */
const ARBITRUM_ESTIMATE_BUFFER_BPS = 110n
const ARBITRUM_MIN_GAS_LIMIT = 100_000n
/** 20% over the live L2 price. Arbitrum does not need Ethereum's 2.4× cap. */
const ARBITRUM_FEE_BUFFER_BPS = 120n
const ARBITRUM_CHAIN_IDS = new Set([42161, 421614])
/** Signature checks + execTransaction overhead above the GS010 remaining-gas check. */
const EXEC_TRANSACTION_OVERHEAD = 80_000n

/** New Safe txs should leave this at 0 so the contract forwards all remaining gas. */
export const DEFAULT_SAFE_TX_GAS = '0'

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

export function parseSafeTxGas(safeTx: unknown): bigint {
  const raw = (safeTx as SafeExecTxLike | undefined)?.safeTxGas
  if (raw == null || raw === '') return 0n
  try {
    const value = BigInt(raw)
    return value > 0n ? value : 0n
  } catch {
    return 0n
  }
}

/**
 * Outer gas that must be supplied so Safe does not revert GS010
 * (`gasleft() < max(safeTxGas * 64/63, safeTxGas + 2500) + 500`).
 */
export function minGasLimitForSafeTxGas(safeTxGas: bigint): bigint {
  if (safeTxGas <= 0n) return 0n
  const scaled = (safeTxGas * 64n) / 63n
  const inner = scaled > safeTxGas + 2500n ? scaled : safeTxGas + 2500n
  return inner + 500n + EXEC_TRANSACTION_OVERHEAD
}

export function isArbitrumChain(chainId?: number | null): boolean {
  return chainId != null && ARBITRUM_CHAIN_IDS.has(chainId)
}

/** Price a Safe execution from the live L2 gas price, with no Ethereum tip. */
export function arbitrumSafeFees(spotPrice: bigint): Eip1559FeeOverrides {
  const maxFeePerGas = spotPrice > 0n ? (spotPrice * ARBITRUM_FEE_BUFFER_BPS) / 100n : 0n
  return { maxFeePerGas, maxPriorityFeePerGas: 0n }
}

/**
 * Pick the L2 spot price out of a wallet quote. Privy and some RPCs return an
 * Ethereum-sized `gasPrice` / priority fee while the block base fee is the
 * real Arbitrum price (~0.02 gwei).
 */
export function arbitrumSpotPrice(params: {
  gasPrice?: bigint | null
  baseFeePerGas?: bigint | null
  maxFeePerGas?: bigint | null
}): bigint {
  const gasPrice = params.gasPrice ?? 0n
  const baseFee = params.baseFeePerGas ?? 0n
  if (baseFee > 0n && gasPrice > baseFee * 5n) return baseFee
  if (gasPrice > 0n) return gasPrice
  if (baseFee > 0n) return baseFee
  return params.maxFeePerGas ?? 0n
}

export function resolveSafeExecutionGasLimit(params: {
  estimatedGas?: bigint | null
  isRejectionTx: boolean
  safeTxGas?: bigint | null
  bufferBps?: bigint
  minGasLimit?: bigint
}): bigint {
  const fallback = params.isRejectionTx ? REJECTION_FALLBACK_GAS_LIMIT : FALLBACK_GAS_LIMIT
  const cap = params.isRejectionTx ? REJECTION_MAX_GAS_LIMIT : MAX_GAS_LIMIT
  const minGas = params.minGasLimit ?? MIN_GAS_LIMIT
  const bufferBps = params.bufferBps ?? ESTIMATE_BUFFER_BPS
  const safeFloor = minGasLimitForSafeTxGas(params.safeTxGas ?? 0n)
  const estimated = params.estimatedGas

  let limit = estimated == null || estimated <= 0n ? fallback : (estimated * bufferBps) / 100n
  if (limit < minGas) limit = minGas
  if (limit < safeFloor) limit = safeFloor
  if (limit > cap && safeFloor <= cap) limit = cap
  if (limit < safeFloor) limit = safeFloor
  return limit
}

export function buildSafeExecutionOptions(params: {
  estimatedGas?: bigint | null
  isRejectionTx: boolean
  safeTxGas?: bigint | null
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  bufferBps?: bigint
  minGasLimit?: bigint
  /** When estimation fails, let the Safe SDK estimate instead of forcing a large fallback. */
  skipUnestimatedGasLimit?: boolean
}): TransactionOptions {
  const fees = {
    maxFeePerGas: params.maxFeePerGas.toString(),
    maxPriorityFeePerGas: params.maxPriorityFeePerGas.toString(),
  }
  const hasEstimate = params.estimatedGas != null && params.estimatedGas > 0n
  if (params.skipUnestimatedGasLimit && !hasEstimate) return fees
  return {
    ...fees,
    gasLimit: resolveSafeExecutionGasLimit(params).toString(),
  }
}

function packConfirmations(
  confirmations: Array<{ owner?: string; signature?: string }> | undefined
): string {
  const sorted = [...(confirmations ?? [])]
    .filter((c) => c.signature)
    .sort((a, b) => (a.owner ?? '').toLowerCase().localeCompare((b.owner ?? '').toLowerCase()))
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
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  provider: {
    estimateGas: (tx: {
      to: string
      from?: string
      data: string
      maxFeePerGas?: string
      maxPriorityFeePerGas?: string
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
    const feeFields =
      params.maxFeePerGas != null && params.maxFeePerGas > 0n
        ? {
            maxFeePerGas: params.maxFeePerGas.toString(),
            maxPriorityFeePerGas: (params.maxPriorityFeePerGas ?? 0n).toString(),
          }
        : {}
    const est = await params.provider.estimateGas({
      to,
      data,
      ...(from ? { from } : {}),
      ...feeFields,
    })
    const value = BigInt(est.toString())
    return value > 0n ? value : null
  } catch {
    return null
  }
}

type ExecutionProvider = {
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
    maxFeePerGas?: string
    maxPriorityFeePerGas?: string
  }) => Promise<{ toString(): string }>
  getSigner?: () => { getAddress: () => Promise<string> }
}

function asBigInt(value: { toString(): string } | null | undefined): bigint {
  if (value == null) return 0n
  try {
    return BigInt(value.toString())
  } catch {
    return 0n
  }
}

/** Live L2 price from our RPC, not the wallet's Ethereum fee quote. */
export async function fetchArbitrumSpotPrice(chainId: number): Promise<bigint | null> {
  try {
    const response = await fetch(`/api/rpc/gas-price?chainId=${chainId}`)
    if (!response.ok) return null
    const data = await response.json()
    const gasPrice = parseOptionalHexBigInt(data?.gasPrice) ?? 0n
    const baseFee = parseOptionalHexBigInt(data?.baseFeePerGas) ?? 0n
    const spot = gasPrice > 0n ? gasPrice : baseFee
    return spot > 0n ? spot : null
  } catch {
    return null
  }
}

async function resolveExecutionFees(
  chainId: number | undefined,
  provider: ExecutionProvider
): Promise<Eip1559FeeOverrides> {
  if (isArbitrumChain(chainId) && chainId) {
    const spot = await fetchArbitrumSpotPrice(chainId)
    if (spot) return arbitrumSafeFees(spot)
  }

  if (!isArbitrumChain(chainId)) {
    return resolveEip1559FeesFromProvider(provider)
  }

  const [fee, block] = await Promise.all([provider.getFeeData(), provider.getBlock('latest')])
  const snapshot = feesFromProviderSnapshot(fee, block)
  return arbitrumSafeFees(
    arbitrumSpotPrice({
      gasPrice: asBigInt(fee.gasPrice),
      baseFeePerGas: asBigInt(block?.baseFeePerGas),
      maxFeePerGas: snapshot.maxFeePerGas,
    })
  )
}

export async function resolveSafeExecutionOptions(params: {
  safe: {
    getAddress: () => Promise<string>
    getEncodedTransaction?: (tx: unknown) => Promise<string>
  }
  safeTx: unknown
  isRejectionTx: boolean
  chainId?: number
  provider: ExecutionProvider
}): Promise<TransactionOptions> {
  // Resolve fees first so estimateGas uses the same cap the signed tx will.
  // Passing `from` without fees can make the node apply wallet getFeeData()
  // and reject the estimate as insufficient funds.
  const arbitrum = isArbitrumChain(params.chainId)
  const fees = await resolveExecutionFees(params.chainId, params.provider)
  const estimatedGas = await estimateSafeExecutionGas({
    safe: params.safe,
    safeTx: params.safeTx,
    provider: params.provider,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  return buildSafeExecutionOptions({
    estimatedGas,
    isRejectionTx: params.isRejectionTx,
    safeTxGas: parseSafeTxGas(params.safeTx),
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    bufferBps: arbitrum ? ARBITRUM_ESTIMATE_BUFFER_BPS : undefined,
    minGasLimit: arbitrum ? ARBITRUM_MIN_GAS_LIMIT : undefined,
    // A failed pre-estimate used to force 500k–750k. On Arbitrum that is several
    // times a normal transfer, so leave gasLimit unset and let the SDK estimate
    // the call it will actually send.
    skipUnestimatedGasLimit: arbitrum,
  })
}
