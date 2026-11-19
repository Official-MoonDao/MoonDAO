import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { decodeForecastVote } from '@/lib/deprize/forecastVote'
import { pickFromAllocation } from '@/lib/forecasts/forecastPick'
import {
  isSameWalletHandoff,
  peekPendingHandoff,
  takePendingHandoff,
} from '@/lib/forecasts/guestHandoff'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

/** Identity of the roster a handoff is allowed to trust. */
export function forecastRosterKey(chainSlug: string, deprizeId: number, address?: string): string {
  return `${chainSlug}:${deprizeId}:${address?.toLowerCase() ?? ''}`
}

/**
 * A handoff rewrite signs with the account the visitor just connected. That
 * wallet may still be on another network. Switching it and then treating the
 * switch as a failed rewrite burns the one attempt: the guest row is already
 * deleted, and nothing retries when the wallet arrives on the prize chain.
 */
export function handoffNetworkAction(
  networkReady: boolean | undefined,
  switchAttempted: boolean
): 'write' | 'switch' | 'wait' {
  if (networkReady !== false) return 'write'
  if (switchAttempted) return 'wait'
  return 'switch'
}

/**
 * After a chain switch the active account is rebuilt asynchronously. The
 * account object from the switch itself still broadcasts on the old network.
 */
export function handoffSignerReady(
  switched: boolean,
  signer: unknown,
  signerAtSwitch: unknown
): boolean {
  if (!switched) return true
  return signer !== signerAtSwitch
}

/**
 * Rewrites one guest forecast onto the signed-in account.
 *
 * The stored copy is removed only after the rewrite lands. A failed gas
 * sponsor, a rejected transaction, or a vote that cannot be decoded yet
 * leaves it in place. Each prize is attempted on its own, including when
 * the same panel instance is reused for another /deprize/[id].
 */
export function useGuestForecastHandoff(args: {
  chainSlug: string
  deprizeId: number
  accountAddress?: string
  isGuest: boolean
  /** The roster on screen belongs to this account and prize. */
  rosterReady: boolean
  inputsLocked: boolean
  writing: boolean
  savedPick: number | null
  n: number
  commitPick: (index: number) => Promise<boolean>
  /**
   * False when the signing wallet is on another chain. Undefined means the
   * caller has no chain guard and the rewrite may proceed.
   */
  networkReady?: boolean
  /** Switch the signing wallet onto the prize chain. False if the visitor declines. */
  ensureNetwork?: () => Promise<boolean>
  /** Name used when a switch is declined, e.g. "Arbitrum". */
  networkLabel?: string
  /** Active account object. Identity changes once it has been rebuilt on the new chain. */
  signer?: unknown
}): void {
  const commitPickRef = useRef(args.commitPick)
  commitPickRef.current = args.commitPick
  const ensureNetworkRef = useRef(args.ensureNetwork)
  ensureNetworkRef.current = args.ensureNetwork
  const networkLabelRef = useRef(args.networkLabel)
  networkLabelRef.current = args.networkLabel
  const attemptScope = useRef<string | null>(null)
  const switchScope = useRef<string | null>(null)
  const switchedFromSigner = useRef<unknown>(undefined)
  const sawSwitch = useRef(false)
  const scopeRef = useRef<string | null>(null)

  const accountAddress = args.accountAddress?.toLowerCase() ?? ''
  const scope = `${args.chainSlug}:${args.deprizeId}:${accountAddress}`
  // A different prize or account gets its own attempt. A failed rewrite of
  // this one stays put until the visitor comes back to it.
  if (scopeRef.current !== scope) {
    scopeRef.current = scope
    attemptScope.current = null
    switchScope.current = null
    switchedFromSigner.current = undefined
    sawSwitch.current = false
  }

  const {
    chainSlug,
    deprizeId,
    isGuest,
    rosterReady,
    inputsLocked,
    writing,
    savedPick,
    n,
    networkReady,
    signer,
  } = args

  useEffect(() => {
    if (!accountAddress || isGuest) return

    const pending = peekPendingHandoff(chainSlug, deprizeId)
    if (!pending) return

    // Creating an account keeps the guest wallet, so this row is already
    // theirs. Drop the note before the roster loads: rewriting it while the
    // gateway still lags the confirmed insert would be a duplicate.
    if (isSameWalletHandoff(pending, accountAddress)) {
      takePendingHandoff(chainSlug, deprizeId)
      attemptScope.current = scope
      return
    }

    if (!rosterReady || inputsLocked || writing) return
    if (attemptScope.current === scope) return

    // This account already has a forecast. Drop the guest copy so a later
    // undo does not write it back over that pick.
    if (savedPick != null) {
      takePendingHandoff(chainSlug, deprizeId)
      attemptScope.current = scope
      return
    }

    const decoded = decodeForecastVote(pending.vote, n)
    const pick = decoded ? pickFromAllocation(decoded.allocation) : null
    // The outcome count may still be wrong. Keep the copy and try when it settles.
    if (pick == null) return

    // The guest row is already gone. Switching chains must not count as the
    // rewrite attempt, or the pick stays in this browser until a later visit.
    const networkAction = handoffNetworkAction(networkReady, switchScope.current === scope)
    if (networkAction === 'wait') return
    if (networkAction === 'switch') {
      switchScope.current = scope
      sawSwitch.current = true
      switchedFromSigner.current = signer
      const label = networkLabelRef.current
      void ensureNetworkRef.current?.().then((switched) => {
        if (switched !== false || !label) return
        toast.error(`Switch your wallet to ${label} to move your prediction.`, {
          id: 'deprize-network',
          style: toastStyle,
        })
      })
      return
    }

    // The wallet reports the prize chain before its signing account is rebuilt.
    if (!handoffSignerReady(sawSwitch.current, signer, switchedFromSigner.current)) return

    attemptScope.current = scope
    void commitPickRef.current(pick).then((ok) => {
      // A failure leaves the attempt set. Clearing it here would retry at
      // once, because the write's own setState runs this effect again.
      if (ok) takePendingHandoff(chainSlug, deprizeId)
    })
  }, [
    accountAddress,
    chainSlug,
    deprizeId,
    isGuest,
    inputsLocked,
    n,
    networkReady,
    signer,
    rosterReady,
    savedPick,
    scope,
    writing,
  ])
}
