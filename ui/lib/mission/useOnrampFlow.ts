import { useWallets } from '@privy-io/react-auth'
import type { NextRouter } from 'next/router'
import { useContext, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useOnrampJWT from '../coinbase/useOnrampJWT'
import { getChainSlug, v4SlugToV5Chain } from '../thirdweb/chain'
import ChainContextV5 from '../thirdweb/chain-context-v5'

type UseOnrampFlowReturn = {
  usdInput: string
  setUsdInput: (value: string) => void
  contributeModalEnabled: boolean
  setContributeModalEnabled: (enabled: boolean) => void
}

/**
 * Hook to manage onramp flow: chain switching and modal state.
 * JWT verification and auto-transaction are handled by the modal using useOnrampAutoTransaction.
 */
export function useOnrampFlow(router: NextRouter, chainSlugs: string[]): UseOnrampFlowReturn {
  const account = useActiveAccount()
  const { wallets } = useWallets()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)

  const chainSlug = getChainSlug(selectedChain)

  const [usdInput, setUsdInput] = useState<string>('')
  const [contributeModalEnabled, setContributeModalEnabled] = useState(false)
  const [hasReadInitialChainParam, setHasReadInitialChainParam] = useState(false)
  const hasProcessedOnrampRef = useRef(false)

  const { getStoredJWT } = useOnrampJWT()

  // Handle chain switching from URL params
  useEffect(() => {
    const chainToSwitchTo = router?.query?.chain as string | undefined

    // Only process initial chain param once
    if (!hasReadInitialChainParam) {
      if (
        chainToSwitchTo &&
        chainToSwitchTo !== chainSlug &&
        chainSlugs.includes(chainToSwitchTo)
      ) {
        const targetChain = v4SlugToV5Chain(chainToSwitchTo)
        if (targetChain && setSelectedChain) {
          setTimeout(() => {
            setSelectedChain(targetChain)
            setHasReadInitialChainParam(true)
          }, 1000)
        }
      } else {
        // No chain to switch to or already on correct chain, mark as read immediately
        setHasReadInitialChainParam(true)
      }
    }
  }, [router?.query?.chain, hasReadInitialChainParam, chainSlug, setSelectedChain, chainSlugs])

  // Update URL when chain changes
  useEffect(() => {
    const urlChain = router?.query?.chain as string | undefined

    // Only update URL if we've read the initial chain param to avoid premature updates
    if (hasReadInitialChainParam && urlChain && urlChain !== chainSlug) {
      router.replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            chain: chainSlug,
          },
        },
        undefined,
        { shallow: true }
      )
    }
  }, [chainSlug, hasReadInitialChainParam, router])

  // Open modal when returning from onramp and JWT exists
  useEffect(() => {
    if (!router?.isReady) return

    const onrampSuccess = router?.query?.onrampSuccess === 'true'

    if (onrampSuccess) {
      // Wait for wallet to be available
      if (!wallets?.[0] || !account?.address) {
        return
      }

      // Check if JWT exists (modal will handle verification)
      const storedJWT = getStoredJWT()
      if (!storedJWT) {
        return
      }

      // Only open modal once per onramp return
      if (hasProcessedOnrampRef.current) {
        if (!contributeModalEnabled) {
          setContributeModalEnabled(true)
        }
        return
      }

      // Small delay to ensure wallet is loaded
      const timeoutId = setTimeout(() => {
        hasProcessedOnrampRef.current = true
        setContributeModalEnabled(true)
      }, 500)

      return () => clearTimeout(timeoutId)
    } else {
      // Reset when not in onramp success scenario
      hasProcessedOnrampRef.current = false
    }
  }, [
    router?.isReady,
    router?.query?.onrampSuccess,
    wallets,
    account?.address,
    getStoredJWT,
    contributeModalEnabled,
  ])

  // Reset ref when component unmounts or onrampSuccess is removed
  useEffect(() => {
    return () => {
      if (!router?.query?.onrampSuccess) {
        hasProcessedOnrampRef.current = false
      }
    }
  }, [router?.query?.onrampSuccess])

  return {
    usdInput,
    setUsdInput,
    contributeModalEnabled,
    setContributeModalEnabled,
  }
}
