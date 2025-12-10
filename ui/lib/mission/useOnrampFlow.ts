import { useWallets } from '@privy-io/react-auth'
import type { NextRouter } from 'next/router'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useOnrampJWT, { OnrampJwtPayload } from '../coinbase/useOnrampJWT'
import PrivyWalletContext from '../privy/privy-wallet-context'
import { getChainSlug, v4SlugToV5Chain } from '../thirdweb/chain'
import ChainContextV5 from '../thirdweb/chain-context-v5'

type Mission = {
  id: string | number
  [key: string]: any
}

type UseOnrampFlowReturn = {
  onrampJWTPayload: OnrampJwtPayload | null
  usdInput: string
  setUsdInput: (value: string) => void
  contributeModalEnabled: boolean
  setContributeModalEnabled: (enabled: boolean) => void
  checkAndVerifyStoredJWT: () => Promise<void>
}

/**
 * Hook to manage onramp flow including JWT verification, chain switching, and modal state
 */
export function useOnrampFlow(
  mission: Mission,
  router: NextRouter,
  chainSlugs: string[]
): UseOnrampFlowReturn {
  const account = useActiveAccount()
  const { wallets } = useWallets()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)

  const chainSlug = getChainSlug(selectedChain)

  const [usdInput, setUsdInput] = useState<string>('')
  const [contributeModalEnabled, setContributeModalEnabled] = useState(false)
  const [onrampJWTPayload, setOnrampJWTPayload] = useState<OnrampJwtPayload | null>(null)
  const [hasReadInitialChainParam, setHasReadInitialChainParam] = useState(false)
  const hasProcessedOnrampRef = useRef(false)

  const {
    verifyJWT: verifyOnrampJWT,
    clearJWT: clearOnrampJWT,
    getStoredJWT: getStoredOnrampJWT,
  } = useOnrampJWT()

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
  }, [
    router?.query?.chain,
    hasReadInitialChainParam,
    chainSlug,
    setSelectedChain,
    chainSlugs,
  ])

  // Update URL when chain changes (but only after initial chain param has been read)
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

  // Check for stored JWT and verify it proactively
  const checkAndVerifyStoredJWT = useCallback(async () => {
    if (!router?.isReady || !account?.address) return

    const storedJWT = getStoredOnrampJWT()
    if (!storedJWT) {
      // No stored JWT - clear any existing payload
      if (onrampJWTPayload) {
        setOnrampJWTPayload(null)
      }
      return
    }

    // Don't re-verify if we already have a valid payload
    if (onrampJWTPayload) {
      // Verify it still matches current context
      if (
        onrampJWTPayload.address?.toLowerCase() === account.address?.toLowerCase() &&
        onrampJWTPayload.chainSlug === chainSlug &&
        onrampJWTPayload.missionId === mission.id?.toString()
      ) {
        return // Already have valid payload
      }
      // Payload doesn't match - clear it and re-verify
      setOnrampJWTPayload(null)
    }

    try {
      const payload = await verifyOnrampJWT(
        storedJWT,
        account.address,
        mission.id?.toString()
      )

      if (!payload) {
        // Verification failed - clear invalid JWT
        clearOnrampJWT()
        setOnrampJWTPayload(null)
        return
      }

      // Validate payload matches current context
      if (
        !payload.address ||
        !payload.chainSlug ||
        payload.address.toLowerCase() !== account.address?.toLowerCase() ||
        payload.chainSlug !== chainSlug ||
        payload.missionId !== mission.id?.toString()
      ) {
        // Invalid - clear JWT and payload
        clearOnrampJWT()
        setOnrampJWTPayload(null)
        return
      }

      // Set wallet based on JWT payload if needed
      if (
        payload.selectedWallet !== undefined &&
        payload.selectedWallet !== selectedWallet
      ) {
        setSelectedWallet(payload.selectedWallet)
      }

      // Set verified payload
      setOnrampJWTPayload(payload)
      if (payload.usdAmount) {
        setUsdInput(payload.usdAmount)
      }

      // If coming from onramp redirect, open modal
      const onrampSuccess = router?.query?.onrampSuccess === 'true'
      if (onrampSuccess && !hasProcessedOnrampRef.current) {
        hasProcessedOnrampRef.current = true
        setContributeModalEnabled(true)
      }
    } catch (error) {
      console.error('Error verifying stored JWT:', error)
      clearOnrampJWT()
      setOnrampJWTPayload(null)
    }
  }, [
    router?.isReady,
    router?.query?.onrampSuccess,
    account?.address,
    getStoredOnrampJWT,
    verifyOnrampJWT,
    chainSlug,
    mission.id,
    onrampJWTPayload,
    selectedWallet,
    setSelectedWallet,
    clearOnrampJWT,
  ])

  // Check for stored JWT when component mounts or when account/chain changes
  useEffect(() => {
    if (!router?.isReady || !account?.address) return

    checkAndVerifyStoredJWT()
  }, [router?.isReady, account?.address, chainSlug, checkAndVerifyStoredJWT])

  // Handle post-onramp modal opening (when onrampSuccess is in URL)
  useEffect(() => {
    if (!router?.isReady) return

    const onrampSuccess = router?.query?.onrampSuccess === 'true'

    if (onrampSuccess) {
      // Wait for account to be available
      if (!wallets?.[0] || !account?.address) {
        return
      }

      // If already processed, just ensure modal is open if needed
      if (hasProcessedOnrampRef.current) {
        if (onrampJWTPayload && !contributeModalEnabled) {
          setContributeModalEnabled(true)
        }
        return
      }

      // Add a small delay to ensure account is loaded
      const timeoutId = setTimeout(() => {
        hasProcessedOnrampRef.current = true
        checkAndVerifyStoredJWT()
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
    checkAndVerifyStoredJWT,
    contributeModalEnabled,
    onrampJWTPayload,
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
    onrampJWTPayload,
    usdInput,
    setUsdInput,
    contributeModalEnabled,
    setContributeModalEnabled,
    checkAndVerifyStoredJWT,
  }
}

