import { useEffect, useCallback, useRef } from 'react'
import useOnrampJWT from './useOnrampJWT'
import { useOnrampRedirect } from './useOnrampRedirect'

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'

interface UseOnrampAutoTransactionOptions {
  address: string | undefined
  context: string
  expectedChainSlug: string
  refetchNativeBalance: () => Promise<void>
  onTransaction: () => void | Promise<void> | Promise<string | undefined>
  onFormRestore?: (restored: any) => void
  checkBalanceSufficient: () => Promise<boolean>
  shouldProceed?: (restored: any) => boolean
  restoreCache: () => any | null
  getChainSlugFromCache?: (restored: any) => string | undefined
  setStage?: (stage: number) => void
  setSelectedWallet?: (index: number) => void
  maxAttempts?: number
  delayMs?: number
  waitForReady?: () => boolean
  waitForReadyMaxAttempts?: number
  waitForReadyDelayMs?: number
}

export function useOnrampAutoTransaction({
  address,
  context,
  expectedChainSlug,
  refetchNativeBalance,
  onTransaction,
  onFormRestore,
  checkBalanceSufficient,
  shouldProceed,
  restoreCache,
  getChainSlugFromCache,
  setStage,
  setSelectedWallet,
  maxAttempts = 10,
  delayMs = 1000,
  waitForReady,
  waitForReadyMaxAttempts = 30,
  waitForReadyDelayMs = 500,
}: UseOnrampAutoTransactionOptions) {
  const { isReturningFromOnramp, clearRedirectParams } = useOnrampRedirect()
  const { verifyJWT, getStoredJWT, clearJWT } = useOnrampJWT()

  // Use ref to always have the latest address
  const addressRef = useRef(address)
  useEffect(() => {
    addressRef.current = address
  }, [address])

  // Use ref to always have the latest onTransaction callback
  const onTransactionRef = useRef(onTransaction)
  useEffect(() => {
    onTransactionRef.current = onTransaction
  }, [onTransaction])

  // Use ref to always have the latest waitForReady callback
  const waitForReadyRef = useRef(waitForReady)
  useEffect(() => {
    waitForReadyRef.current = waitForReady
  }, [waitForReady])

  // Store the expected address from JWT verification
  const expectedAddressRef = useRef<string | null>(null)

  // Guard against multiple effect executions
  const isProcessingRef = useRef(false)
  // Track if processing completed successfully to prevent re-runs
  const hasProcessedRef = useRef(false)

  const clearExpectedAddress = useCallback(() => {
    expectedAddressRef.current = null
  }, [])

  const pollBalanceAndExecute = useCallback(async () => {
    console.log('[AutoTx] pollBalanceAndExecute started')

    // Verify address hasn't changed since JWT verification
    if (expectedAddressRef.current && addressRef.current) {
      if (addressRef.current.toLowerCase() !== expectedAddressRef.current.toLowerCase()) {
        console.error(
          '[AutoTx] Address mismatch: expected',
          expectedAddressRef.current,
          'got',
          addressRef.current
        )
        clearJWT()
        clearExpectedAddress()
        return
      }
    }

    // In mock mode, skip balance polling and execute immediately
    if (MOCK_ONRAMP) {
      console.log('[AutoTx] Mock mode, executing immediately')
      await onTransactionRef.current()
      clearJWT()
      clearExpectedAddress()
      return
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Re-verify address on each attempt
      if (expectedAddressRef.current && addressRef.current) {
        if (addressRef.current.toLowerCase() !== expectedAddressRef.current.toLowerCase()) {
          console.error('Address changed during balance polling')
          clearJWT()
          clearExpectedAddress()
          return
        }
      }

      await refetchNativeBalance()
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      try {
        const isSufficient = await checkBalanceSufficient()
        if (isSufficient) {
          await onTransactionRef.current()
          clearJWT()
          clearExpectedAddress()
          return
        }
      } catch (error) {
        console.error('Error checking balance:', error)
      }
    }

    await onTransactionRef.current()
    clearJWT()
    clearExpectedAddress()
  }, [
    maxAttempts,
    delayMs,
    refetchNativeBalance,
    checkBalanceSufficient,
    clearJWT,
    clearExpectedAddress,
  ])

  const waitForReadyAndExecute = useCallback(async () => {
    if (!waitForReadyRef.current) {
      await pollBalanceAndExecute()
      return
    }

    for (let attempt = 0; attempt < waitForReadyMaxAttempts; attempt++) {
      // Verify address hasn't changed
      if (expectedAddressRef.current && addressRef.current) {
        if (addressRef.current.toLowerCase() !== expectedAddressRef.current.toLowerCase()) {
          console.error('[AutoTx] Address changed while waiting for ready')
          clearJWT()
          clearExpectedAddress()
          return
        }
      }

      const isReady = waitForReadyRef.current()

      if (isReady) {
        await pollBalanceAndExecute()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, waitForReadyDelayMs))
    }

    //Final attempt
    await pollBalanceAndExecute()
  }, [
    pollBalanceAndExecute,
    waitForReadyMaxAttempts,
    waitForReadyDelayMs,
    clearJWT,
    clearExpectedAddress,
  ])

  useEffect(() => {
    if (hasProcessedRef.current) {
      return
    }

    if (!isReturningFromOnramp || !address || !onTransactionRef.current) {
      return
    }

    if (isProcessingRef.current) {
      console.warn('[AutoTx] Already processing, skipping')
      return
    }

    const restored = restoreCache()
    if (!restored) {
      return
    }

    isProcessingRef.current = true

    if (onFormRestore) {
      onFormRestore(restored)
    }

    const storedJWT = getStoredJWT()
    if (!storedJWT) {
      console.log('[AutoTx] No stored JWT, clearing redirect params')
      clearRedirectParams()
      return
    }

    // Use chain slug from cache if available, otherwise fall back to prop
    const cachedChainSlug = getChainSlugFromCache ? getChainSlugFromCache(restored) : undefined
    const chainSlugToVerify = cachedChainSlug || expectedChainSlug

    // First, decode the JWT to check the address without full verification
    fetch('/api/coinbase/verify-onramp-jwt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: storedJWT }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid || !data.payload) {
          console.log('[AutoTx] JWT invalid or expired')
          clearJWT()
          clearRedirectParams()
          isProcessingRef.current = false
          return
        }

        const jwtPayload = data.payload
        // Use addressRef to get the CURRENT address, not the one captured when effect started
        const currentAddress = addressRef.current

        // Check if current address matches JWT address
        if (!currentAddress || jwtPayload.address.toLowerCase() !== currentAddress.toLowerCase()) {
          // If JWT has a selectedWallet, switch to it - this will trigger the effect again
          if (jwtPayload.selectedWallet !== undefined && setSelectedWallet) {
            console.log('[AutoTx] Switching to wallet index:', jwtPayload.selectedWallet)
            setSelectedWallet(jwtPayload.selectedWallet)
          }
          // Wait for correct wallet to connect
          isProcessingRef.current = false
          return
        }

        // Full verification
        return verifyJWT(storedJWT, currentAddress, undefined, context).then((payload) => {
          if (!payload) {
            console.error('[AutoTx] JWT verification failed')
            clearJWT()
            clearRedirectParams()
            isProcessingRef.current = false
            return
          }

          if (payload.chainSlug !== chainSlugToVerify) {
            console.error('[AutoTx] JWT verification failed: chainSlug mismatch', {
              jwtChainSlug: payload.chainSlug,
              expectedChainSlug: chainSlugToVerify,
            })
            clearJWT()
            clearRedirectParams()
            isProcessingRef.current = false
            return
          }

          if (payload.context !== context) {
            console.error('[AutoTx] JWT verification failed: context mismatch', {
              jwtContext: payload.context,
              expectedContext: context,
            })
            clearJWT()
            clearRedirectParams()
            isProcessingRef.current = false
            return
          }

          console.log('[AutoTx] JWT verified successfully')

          // Store the expected address for verification during execution
          expectedAddressRef.current = payload.address

          // Restore wallet based on JWT payload if needed (multi-wallet support)
          if (payload.selectedWallet !== undefined && setSelectedWallet) {
            setSelectedWallet(payload.selectedWallet)
          }

          clearRedirectParams()

          const proceed = shouldProceed ? shouldProceed(restored) : true
          if (proceed) {
            hasProcessedRef.current = true
            setTimeout(() => {
              waitForReadyAndExecute().finally(() => {
                isProcessingRef.current = false
              })
            }, 1000)
          } else {
            clearJWT()
            isProcessingRef.current = false
          }
        })
      })
      .catch((error) => {
        console.error('[AutoTx] Error checking JWT:', error)
        clearJWT()
        clearRedirectParams()
        isProcessingRef.current = false
      })
  }, [
    isReturningFromOnramp,
    address,
    context,
    expectedChainSlug,
    restoreCache,
    clearRedirectParams,
    getStoredJWT,
    verifyJWT,
    clearJWT,
    onFormRestore,
    shouldProceed,
    waitForReadyAndExecute,
    getChainSlugFromCache,
    setSelectedWallet,
  ])
}
