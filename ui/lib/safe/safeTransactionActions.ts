/*
 * Pure, framework-free helpers that decide what a Safe owner can do with a
 * pending transaction (sign / execute / reject) and how it should be labeled.
 *
 * This logic used to live inline inside <SafeTransactions />. It is extracted
 * here so it can be exercised by fast Node unit simulations (no browser /
 * Electron required) and reused by any other surface that needs the same
 * gating rules.
 *
 * Key Safe rule encoded here: an owner can SIGN (confirm) any pending
 * transaction regardless of nonce ordering — only EXECUTION must happen in
 * strict nonce order. Gating signing on the current nonce is a bug.
 */
import { DAI_ADDRESSES, MOONEY_ADDRESSES, USDC_ADDRESSES, USDT_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'

/** Minimal shape this module needs from a Safe pending transaction. */
export type SafeTxLike = {
  to: string
  value: string
  data?: string | null
  nonce: number
  isExecuted?: boolean
  confirmationsRequired?: number
  confirmations?: Array<{ owner: string }> | null
  dataDecoded?: { method?: string; parameters?: any[] } | null
}

function isZeroData(data: SafeTxLike['data']): boolean {
  return data === '0x' || data === null || data === undefined
}

function valueAsBN(value: SafeTxLike['value']) {
  // Safe API returns value as a string; default to 0 if missing.
  return ethers.BigNumber.from(value ?? '0')
}

/** A transaction whose only effect is to consume a nonce (Safe "Reject"). */
export function isRejectionTransaction(tx: SafeTxLike): boolean {
  const method = tx.dataDecoded?.method
  return (
    method === 'rejectTransaction' ||
    method === 'Reject Transaction' ||
    !!method?.toLowerCase().includes('reject') ||
    (isZeroData(tx.data) && valueAsBN(tx.value).eq(0))
  )
}

/** A plain ETH transfer (no calldata, non-zero value). */
export function isEthTransfer(tx: SafeTxLike): boolean {
  return isZeroData(tx.data) && valueAsBN(tx.value).gt(0)
}

const ERC20_INTERFACE = new ethers.utils.Interface([
  'function transfer(address to, uint256 value)',
  'function transferFrom(address from, address to, uint256 value)',
])

export type DecodedTokenTransfer = {
  method: 'transfer' | 'transferFrom'
  recipient: string
  /** Raw uint256 amount, not adjusted for decimals. */
  amount: string
}

function asScalar(value: unknown): string | null {
  if (value == null || typeof value === 'object') return null
  const str = String(value)
  if (!str || str === 'undefined') return null
  return str
}

/**
 * Pulls the recipient and raw amount out of an ERC-20 transfer.
 * Prefers Safe's `dataDecoded` payload, then the calldata itself, so a USDC
 * send still shows an amount when the transaction service didn't decode it.
 */
export function decodedTokenTransfer(tx: SafeTxLike): DecodedTokenTransfer | null {
  const method = tx.dataDecoded?.method
  if (method === 'transfer' || method === 'transferFrom') {
    const params = tx.dataDecoded?.parameters ?? []
    const recipient = asScalar(method === 'transfer' ? params[0]?.value : params[1]?.value)
    const amount = asScalar(method === 'transfer' ? params[1]?.value : params[2]?.value)
    if (amount) {
      return { method, recipient: recipient || tx.to, amount }
    }
  }

  const data = tx.data
  if (!data || data === '0x' || data.length < 10) return null
  const selector = data.slice(0, 10).toLowerCase()
  try {
    if (selector === '0xa9059cbb') {
      const decoded = ERC20_INTERFACE.decodeFunctionData('transfer', data)
      return {
        method: 'transfer',
        recipient: decoded.to,
        amount: decoded.value.toString(),
      }
    }
    if (selector === '0x23b872dd') {
      const decoded = ERC20_INTERFACE.decodeFunctionData('transferFrom', data)
      return {
        method: 'transferFrom',
        recipient: decoded.to,
        amount: decoded.value.toString(),
      }
    }
  } catch {
    return null
  }
  return null
}

export function isTokenTransfer(tx: SafeTxLike): boolean {
  const method = tx.dataDecoded?.method
  if (method === 'transfer' || method === 'transferFrom') return true
  return decodedTokenTransfer(tx) != null
}

function addressSet(addresses: { [key: string]: string }): Set<string> {
  return new Set(
    Object.values(addresses)
      .filter((address) => typeof address === 'string' && address.startsWith('0x'))
      .map((address) => address.toLowerCase())
  )
}

const USDC_ADDRESSES_LOWER = addressSet(USDC_ADDRESSES)
const USDT_ADDRESSES_LOWER = addressSet(USDT_ADDRESSES)
const DAI_ADDRESSES_LOWER = addressSet(DAI_ADDRESSES)
const MOONEY_ADDRESSES_LOWER = addressSet(MOONEY_ADDRESSES)

/** Decimals and symbol for tokens we know without an RPC read. USDC is 6. */
export function knownErc20Meta(
  address?: string | null
): { decimals: number; symbol: string } | null {
  if (!address) return null
  const normalized = address.toLowerCase()
  if (USDC_ADDRESSES_LOWER.has(normalized)) return { decimals: 6, symbol: 'USDC' }
  if (USDT_ADDRESSES_LOWER.has(normalized)) return { decimals: 6, symbol: 'USDT' }
  if (DAI_ADDRESSES_LOWER.has(normalized)) return { decimals: 18, symbol: 'DAI' }
  if (MOONEY_ADDRESSES_LOWER.has(normalized)) return { decimals: 18, symbol: 'MOONEY' }
  return null
}

export type TokenBalanceHint = {
  tokenAddress: string | null
  token: { symbol: string; decimals: number } | null
}

/**
 * Symbol and decimals for a token transfer, from the Safe's own balance list
 * when the treasury holds that token, otherwise from the known-token map.
 */
export function resolveTokenHint(
  tx: SafeTxLike,
  balances?: TokenBalanceHint[] | null
): { decimals: number; symbol: string } | null {
  if (!isTokenTransfer(tx) || !tx.to) return null
  const to = tx.to.toLowerCase()
  if (Array.isArray(balances)) {
    const match = balances.find(
      (balance) => balance.tokenAddress?.toLowerCase() === to && balance.token
    )
    const decimals = Number(match?.token?.decimals)
    if (match?.token && Number.isInteger(decimals) && decimals >= 0 && decimals <= 255) {
      return { decimals, symbol: match.token.symbol || 'tokens' }
    }
  }
  return knownErc20Meta(tx.to)
}

/** Trim trailing zeroes after the decimal, then group the whole part. */
export function formatTokenAmount(raw: string, decimals: number): string {
  let formatted: string
  try {
    formatted = ethers.utils.formatUnits(raw, decimals)
  } catch {
    return raw
  }
  if (formatted.includes('.')) {
    formatted = formatted.replace(/0+$/, '').replace(/\.$/, '')
  }
  const [whole, frac] = formatted.split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${withCommas}.${frac}` : withCommas
}

/**
 * Returns the human-readable value to display on a transaction card.
 *
 * - ETH transfers: format tx.value from wei.
 * - ERC-20 transfers: format the decoded uint with the token's own decimals.
 *   Returns null until the caller supplies those decimals, so a 6-decimal
 *   token like USDC is never shown as if it had 18.
 * - Other calls: show ETH value only when it is non-zero.
 */
export function getTransactionDisplayValue(
  tx: SafeTxLike,
  meta?: { decimals?: number; symbol?: string }
): { amount: string; symbol: string } | null {
  if (isEthTransfer(tx)) {
    return { amount: ethers.utils.formatEther(tx.value ?? '0'), symbol: 'ETH' }
  }

  if (isTokenTransfer(tx)) {
    const decoded = decodedTokenTransfer(tx)
    if (!decoded || meta?.decimals == null) return null
    return {
      amount: formatTokenAmount(decoded.amount, meta.decimals),
      symbol: meta.symbol || 'tokens',
    }
  }

  const valueBN = valueAsBN(tx.value)
  if (valueBN.gt(0)) {
    return { amount: ethers.utils.formatEther(tx.value ?? '0'), symbol: 'ETH' }
  }

  return null
}

/** Human-friendly method label shown on the card. */
export function getTransactionMethod(tx: SafeTxLike, tokenSymbol?: string): string {
  if (isEthTransfer(tx)) return 'Transfer ETH'
  if (isRejectionTransaction(tx)) return 'Reject Transaction'
  if (isTokenTransfer(tx)) return tokenSymbol ? `Transfer ${tokenSymbol}` : 'Token Transfer'
  return tx.dataDecoded?.method || 'Unknown Method'
}

/**
 * The address the user cares about: for ERC-20 transfers this is the token
 * recipient (decoded param), not the token contract in `tx.to`.
 */
export function getRecipientAddress(tx: SafeTxLike): string {
  const decoded = decodedTokenTransfer(tx)
  if (decoded?.recipient) return decoded.recipient
  return tx.to
}

/** Group transactions sharing a nonce (only one of each nonce can execute). */
export function groupTransactionsByNonce<T extends { nonce: number }>(
  transactions: T[]
): Array<{ nonce: number; transactions: T[] }> {
  const grouped = transactions.reduce((acc, tx) => {
    if (!acc[tx.nonce]) acc[tx.nonce] = []
    acc[tx.nonce].push(tx)
    return acc
  }, {} as { [nonce: number]: T[] })

  return Object.entries(grouped).map(([nonce, txs]) => ({
    nonce: Number(nonce),
    transactions: txs,
  }))
}

/** Does this nonce group contain a rejection transaction? */
export function groupHasRejection(transactions: SafeTxLike[]): boolean {
  return transactions.some((tx) => isRejectionTransaction(tx))
}

export type TxActionContext = {
  threshold: number
  currentNonce: number | null | undefined
  /** Connected owner address (lowercased comparison done internally). */
  address: string | undefined
  /** Whether the nonce group this tx belongs to also has a rejection tx. */
  hasRejectionInGroup: boolean
}

export type TxActionState = {
  hasSigned: boolean
  requiredConfirmations: number
  confirmationCount: number
  canSign: boolean
  canExecute: boolean
  isBlockedByEarlierNonce: boolean
  // Derived button visibility — mirrors the JSX exactly.
  showSignButton: boolean
  showRejectButton: boolean
  showSignWithRejectionButton: boolean
  showSignedStatus: boolean
  showExecuteButton: boolean
  showRejectAfterSignButton: boolean
  showBlockedIndicator: boolean
}

/**
 * Single source of truth for the action gating + button visibility of a
 * pending Safe transaction.
 */
export function deriveTransactionActions(tx: SafeTxLike, ctx: TxActionContext): TxActionState {
  const confirmations = tx.confirmations || []
  const confirmationCount = confirmations.length
  const requiredConfirmations = tx.confirmationsRequired || ctx.threshold

  const hasSigned = confirmations.some(
    (conf: any) => conf.owner?.toLowerCase() === ctx.address?.toLowerCase()
  )

  const canExecute =
    confirmationCount >= requiredConfirmations && !tx.isExecuted && tx.nonce === ctx.currentNonce

  // Owners can sign ANY pending transaction regardless of nonce ordering.
  const canSign = confirmationCount < requiredConfirmations && !tx.isExecuted

  const isBlockedByEarlierNonce =
    confirmationCount >= requiredConfirmations &&
    !tx.isExecuted &&
    ctx.currentNonce != null &&
    tx.nonce > ctx.currentNonce

  return {
    hasSigned,
    requiredConfirmations,
    confirmationCount,
    canSign,
    canExecute,
    isBlockedByEarlierNonce,
    showSignButton: !hasSigned && !ctx.hasRejectionInGroup && canSign,
    showRejectButton: !hasSigned && !ctx.hasRejectionInGroup,
    showSignWithRejectionButton: !hasSigned && ctx.hasRejectionInGroup && canSign,
    showSignedStatus: hasSigned,
    showExecuteButton: canExecute,
    showRejectAfterSignButton: hasSigned && !tx.isExecuted && !ctx.hasRejectionInGroup,
    showBlockedIndicator: isBlockedByEarlierNonce,
  }
}
