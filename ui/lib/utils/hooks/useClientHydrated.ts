import { startTransition, useEffect, useState } from 'react'

/**
 * False on the server and on the first client render; true after mount.
 * Gate sessionStorage restores and Privy-driven setState so they do not run
 * during React hydration (avoids Suspense boundary errors with next-translate).
 */
export function useClientHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    startTransition(() => setHydrated(true))
  }, [])
  return hydrated
}
