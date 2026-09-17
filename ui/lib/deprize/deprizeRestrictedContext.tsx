import { createContext, createElement, useContext, type ReactNode } from 'react'

const DePrizeRestrictedContext = createContext<boolean | null>(null)

/**
 * Carrier for the SSR DePrize jurisdiction verdict (`DePrizePageProps.restricted`).
 * Never fetches and never re-derives a country list. Mount only on pages that
 * already called `resolveDePrizePageProps`.
 */
export function DePrizeRestrictedProvider({
  restricted,
  children,
}: {
  restricted: boolean
  children: ReactNode
}) {
  return createElement(DePrizeRestrictedContext.Provider, { value: restricted }, children)
}

/**
 * Schedule A / DePrize restricted-jurisdiction verdict for the current page.
 * Throws outside a provider so a missing mount cannot fail open as "not restricted".
 */
export function useDePrizeRestricted(): boolean {
  const value = useContext(DePrizeRestrictedContext)
  if (value === null) {
    throw new Error('useDePrizeRestricted must be used inside DePrizeRestrictedProvider')
  }
  return value
}
