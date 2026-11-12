import { usePrivy } from '@privy-io/react-auth'

/**
 * `usePrivy`, with `authenticated` false for guest accounts. A guest exists
 * only to write free forecasts, so everywhere else it is signed out, and
 * `login()` upgrades it.
 */
export function usePrivyAccount() {
  const privy = usePrivy()
  const isGuest = !!privy.user?.isGuest
  return { ...privy, authenticated: privy.authenticated && !isGuest, isGuest }
}
