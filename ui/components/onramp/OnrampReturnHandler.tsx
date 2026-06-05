import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { consumeOnrampReturn } from '@/lib/onramp/onrampReturn'

/**
 * Returns the user to the page they were funding from after a fiat onramp.
 *
 * Privy's in-app onramp (MoonPay) exposes no return-URL, and the provider's
 * KYC / 3-D Secure step can perform a top-level redirect that lands the user on
 * the site root instead of their original flow (e.g. citizen creation). Before
 * opening the widget we persist the originating path (see setOnrampReturn); here
 * we consume it on the next full page load and route the user back, appending
 * `onrampSuccess=true` so the destination restores its cached state.
 *
 * Mounted once at the app root. SPA navigations don't remount it, so it only
 * fires on a fresh load (which is exactly when a provider redirect returns).
 */
export function OnrampReturnHandler() {
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current || !router.isReady) return
    handledRef.current = true

    const returnPath = consumeOnrampReturn()
    if (!returnPath) return

    // Already on the right page — the page's own restore-on-mount handles it.
    const returnPathname = returnPath.split('?')[0]
    const currentPathname = router.asPath.split('?')[0]
    if (returnPathname === currentPathname) return

    const separator = returnPath.includes('?') ? '&' : '?'
    router.replace(`${returnPath}${separator}onrampSuccess=true`)
  }, [router.isReady, router])

  return null
}
