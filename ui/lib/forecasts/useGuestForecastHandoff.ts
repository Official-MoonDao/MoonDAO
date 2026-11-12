import { useEffect, useRef } from 'react'
import { decodeForecastVote } from '@/lib/deprize/forecastVote'
import { pickFromAllocation } from '@/lib/forecasts/forecastPick'
import { peekPendingHandoff, takePendingHandoff } from '@/lib/forecasts/guestHandoff'

/** Identity of the roster a handoff is allowed to trust. */
export function forecastRosterKey(chainSlug: string, deprizeId: number, address?: string): string {
  return `${chainSlug}:${deprizeId}:${address?.toLowerCase() ?? ''}`
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
}): void {
  const commitPickRef = useRef(args.commitPick)
  commitPickRef.current = args.commitPick
  const attemptScope = useRef<string | null>(null)
  const scopeRef = useRef<string | null>(null)

  const accountAddress = args.accountAddress?.toLowerCase() ?? ''
  const scope = `${args.chainSlug}:${args.deprizeId}:${accountAddress}`
  // A different prize or account gets its own attempt. A failed rewrite of
  // this one stays put until the visitor comes back to it.
  if (scopeRef.current !== scope) {
    scopeRef.current = scope
    attemptScope.current = null
  }

  const { chainSlug, deprizeId, isGuest, rosterReady, inputsLocked, writing, savedPick, n } = args

  useEffect(() => {
    if (!accountAddress || isGuest || !rosterReady || inputsLocked || writing) return
    if (attemptScope.current === scope) return

    const pending = peekPendingHandoff(chainSlug, deprizeId)
    if (!pending) return

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
    rosterReady,
    savedPick,
    scope,
    writing,
  ])
}
