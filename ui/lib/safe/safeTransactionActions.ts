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

export function isTokenTransfer(tx: SafeTxLike): boolean {
  return (
    tx.dataDecoded?.method === 'transfer' ||
    tx.dataDecoded?.method === 'transferFrom'
  )
}

/**
 * Returns the human-readable value to display on a transaction card.
 *
 * - ETH transfers: format tx.value from wei → "1.5 ETH"
 * - ERC-20 transfers: decode the token amount from dataDecoded parameters
 *   (assumes 18 decimals — correct for MOONEY and most standard tokens).
 *   Returns null when the value is zero and there is no decoded token amount,
 *   so callers can hide the row entirely for contract calls with no value.
 */
export function getTransactionDisplayValue(
  tx: SafeTxLike
): { amount: string; symbol: string } | null {
  if (isEthTransfer(tx)) {
    return { amount: ethers.utils.formatEther(tx.value ?? '0'), symbol: 'ETH' }
  }

  if (isTokenTransfer(tx)) {
    const params = tx.dataDecoded?.parameters ?? []
    // transfer(address to, uint256 value)  → params[1]
    // transferFrom(address from, address to, uint256 value) → params[2]
    const amountParam =
      tx.dataDecoded?.method === 'transferFrom' ? params[2] : params[1]
    const raw: string = amountParam?.value ?? '0'
    return {
      amount: ethers.utils.formatEther(
        ethers.BigNumber.from(raw).toString()
      ),
      symbol: 'tokens',
    }
  }

  // Generic contract call — show ETH value only when non-zero.
  const valueBN = valueAsBN(tx.value)
  if (valueBN.gt(0)) {
    return { amount: ethers.utils.formatEther(tx.value ?? '0'), symbol: 'ETH' }
  }

  return null
}

/** Human-friendly method label shown on the card. */
export function getTransactionMethod(tx: SafeTxLike): string {
  if (isEthTransfer(tx)) return 'Transfer ETH'
  if (isRejectionTransaction(tx)) return 'Reject Transaction'
  return tx.dataDecoded?.method || 'Unknown Method'
}

/**
 * The address the user cares about: for ERC-20 transfers this is the token
 * recipient (decoded param), not the token contract in `tx.to`.
 */
export function getRecipientAddress(tx: SafeTxLike): string {
  if (isTokenTransfer(tx)) {
    const paramAddress =
      tx.dataDecoded?.method === 'transfer'
        ? tx.dataDecoded?.parameters?.[0]?.value
        : tx.dataDecoded?.parameters?.[1]?.value
    return paramAddress || tx.to
  }
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
export function deriveTransactionActions(
  tx: SafeTxLike,
  ctx: TxActionContext
): TxActionState {
  const confirmations = tx.confirmations || []
  const confirmationCount = confirmations.length
  const requiredConfirmations = tx.confirmationsRequired || ctx.threshold

  const hasSigned = confirmations.some(
    (conf: any) => conf.owner?.toLowerCase() === ctx.address?.toLowerCase()
  )

  const canExecute =
    confirmationCount >= requiredConfirmations &&
    !tx.isExecuted &&
    tx.nonce === ctx.currentNonce

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
    showSignWithRejectionButton:
      !hasSigned && ctx.hasRejectionInGroup && canSign,
    showSignedStatus: hasSigned,
    showExecuteButton: canExecute,
    showRejectAfterSignButton:
      hasSigned && !tx.isExecuted && !ctx.hasRejectionInGroup,
    showBlockedIndicator: isBlockedByEarlierNonce,
  }
}
