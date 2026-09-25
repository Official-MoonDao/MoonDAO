export const DEPRIZE_SEPOLIA_CHAIN_ID = 11155111
export const DEPRIZE_ARBITRUM_CHAIN_ID = 42161

export type DeprizeChainPin = {
  selectedChainId: number
  pinnedPath: string
  /** Chain in use before the first prefixed prize URL. Null when not inside one. */
  restoreChainId: number | null
}

/**
 * Chain id a prefixed DePrize path forces. `/deprize/sep` is Sepolia even when
 * the app default is Arbitrum. Unprefixed prize URLs do not force a chain.
 */
export function deprizePinnedChainId(pathname: string | undefined): number | undefined {
  if (!pathname) return undefined
  if (pathname === '/deprize/sep' || pathname.startsWith('/deprize/sep/')) {
    return DEPRIZE_SEPOLIA_CHAIN_ID
  }
  if (pathname === '/deprize/arb' || pathname.startsWith('/deprize/arb/')) {
    return DEPRIZE_ARBITRUM_CHAIN_ID
  }
  return undefined
}

/**
 * Selected chain across prize-URL navigations.
 * Entering `/deprize/sep` or `/deprize/arb` selects that network. Leaving it
 * restores the chain from before the pin, unless the user picked a different
 * network while the prize URL was open. Moving between prefixed URLs keeps
 * the original restore target.
 */
export function nextDeprizeChainPin(
  state: DeprizeChainPin,
  pathname: string,
  defaultChainId: number
): DeprizeChainPin {
  const routeChainId = deprizePinnedChainId(pathname)
  const pinnedChainId = deprizePinnedChainId(state.pinnedPath)

  if (routeChainId != null) {
    if (pathname === state.pinnedPath) return state
    return {
      selectedChainId: routeChainId,
      pinnedPath: pathname,
      restoreChainId: pinnedChainId != null ? state.restoreChainId : state.selectedChainId,
    }
  }

  if (pinnedChainId == null) return state

  const stillOnPinnedChain = state.selectedChainId === pinnedChainId
  return {
    selectedChainId: stillOnPinnedChain
      ? state.restoreChainId ?? defaultChainId
      : state.selectedChainId,
    pinnedPath: pathname,
    restoreChainId: null,
  }
}
