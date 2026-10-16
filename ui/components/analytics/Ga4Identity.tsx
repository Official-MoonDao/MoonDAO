import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useRef } from 'react'
import { trackWalletConnect } from '@/lib/analytics/ga4'

/**
 * Fires wallet_connect when a wallet is connected or an embedded wallet
 * appears during this page session. A session that loads already signed in
 * does not count as a new connection.
 */
export function Ga4Identity() {
  const { ready, authenticated, user } = usePrivy()
  const seenReady = useRef(false)
  const lastWallet = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) return
    const address = user?.wallet?.address?.toLowerCase() || ''
    const walletType = user?.wallet?.walletClientType
    if (!seenReady.current) {
      seenReady.current = true
      lastWallet.current = authenticated && address ? address : null
      return
    }
    if (authenticated && address && address !== lastWallet.current) {
      trackWalletConnect(walletType)
    }
    lastWallet.current = authenticated && address ? address : null
  }, [ready, authenticated, user])

  return null
}
