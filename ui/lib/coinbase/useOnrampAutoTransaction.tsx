import { useEffect, useCallback, useRef } from 'react'
import useOnrampJWT from './useOnrampJWT'
import { useOnrampRedirect } from './useOnrampRedirect'

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

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
  // Track the previous isReturningFromOnramp value to reset refs when it changes
  const prevIsReturningFromOnrampRef = useRef(false)
  // Track processing start time for timeout
  const processingStartTimeRef = useRef<number | null>(null)
  // Track the current processing session ID to prevent duplicate processing
  const currentSessionIdRef = useRef<string | null>(null)
  // Track the active processing promise to check if still pending
  const activeProcessingPromiseRef = useRef<Promise<void> | null>(null)

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
        clearRedirectParams()
        hasProcessedRef.current = false
        return
      }
    }

    // In mock mode, skip balance polling and execute immediately
    if (MOCK_ONRAMP) {
      console.log('[AutoTx] Mock mode, executing immediately')
      try {
        await onTransactionRef.current()
        clearJWT()
        clearExpectedAddress()
        clearRedirectParams()
      } catch (error) {
        console.error('[AutoTx] Transaction failed:', error)
        hasProcessedRef.current = false
        throw error
      }
      return
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Re-verify address on each attempt
      if (expectedAddressRef.current && addressRef.current) {
        if (addressRef.current.toLowerCase() !== expectedAddressRef.current.toLowerCase()) {
          console.error('Address changed during balance polling')
          clearJWT()
          clearExpectedAddress()
          clearRedirectParams()
          hasProcessedRef.current = false
          return
        }
      }

      await refetchNativeBalance()
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      try {
        const isSufficient = await checkBalanceSufficient()
        if (isSufficient) {
          try {
            await onTransactionRef.current()
            clearJWT()
            clearExpectedAddress()
            clearRedirectParams()
          } catch (error) {
            console.error('[AutoTx] Transaction failed:', error)
            hasProcessedRef.current = false
            throw error
          }
          return
        }
      } catch (error) {
        console.error('Error checking balance:', error)
      }
    }

    try {
      await onTransactionRef.current()
      clearJWT()
      clearExpectedAddress()
      clearRedirectParams()
    } catch (error) {
      console.error('[AutoTx] Transaction failed:', error)
      hasProcessedRef.current = false
      throw error
    }
  }, [
    maxAttempts,
    delayMs,
    refetchNativeBalance,
    checkBalanceSufficient,
    clearJWT,
    clearExpectedAddress,
    clearRedirectParams,
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
          clearRedirectParams()
          hasProcessedRef.current = false
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
    clearRedirectParams,
  ])

  useEffect(() => {
    let isCancelled = false
    let timeoutId: NodeJS.Timeout | null = null

    // Reset refs when we're no longer returning from onramp
    if (prevIsReturningFromOnrampRef.current && !isReturningFromOnramp) {
      hasProcessedRef.current = false
      isProcessingRef.current = false
      processingStartTimeRef.current = null
      currentSessionIdRef.current = null
      activeProcessingPromiseRef.current = null
    }

    // Generate or reuse session ID when returning from onramp
    // Only generate new session ID when first detecting the redirect
    if (isReturningFromOnramp && address && !currentSessionIdRef.current) {
      currentSessionIdRef.current = `${address}-${Date.now()}`
    }

    const sessionId = currentSessionIdRef.current
    prevIsReturningFromOnrampRef.current = isReturningFromOnramp

    // Check for timeout
    if (isProcessingRef.current && processingStartTimeRef.current) {
      const elapsed = Date.now() - processingStartTimeRef.current
      if (elapsed > PROCESSING_TIMEOUT_MS) {
        console.warn('[AutoTx] Processing timeout, resetting state')
        isProcessingRef.current = false
        hasProcessedRef.current = false
        processingStartTimeRef.current = null
        currentSessionIdRef.current = null
        activeProcessingPromiseRef.current = null
      }
    }

    if (hasProcessedRef.current) {
      return () => {
        isCancelled = true
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    if (!isReturningFromOnramp || !address || !onTransactionRef.current || !sessionId) {
      return () => {
        isCancelled = true
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    // If we've already started processing for this session, skip
    if (currentSessionIdRef.current === sessionId && isProcessingRef.current) {
      // Check if the promise is still pending
      if (activeProcessingPromiseRef.current) {
        console.warn('[AutoTx] Already processing this session, skipping')
        return () => {
          isCancelled = true
          if (timeoutId) clearTimeout(timeoutId)
        }
      } else {
        // Promise completed but flag still set, reset it
        console.warn('[AutoTx] Processing flag set but no active promise, resetting')
        isProcessingRef.current = false
        currentSessionIdRef.current = null
      }
    }

    // If processing a different session, check if we should reset
    if (isProcessingRef.current && currentSessionIdRef.current !== sessionId) {
      if (processingStartTimeRef.current) {
        const elapsed = Date.now() - processingStartTimeRef.current
        if (elapsed > 30000) {
          console.warn('[AutoTx] Previous session processing taking too long, resetting')
          isProcessingRef.current = false
          processingStartTimeRef.current = null
          currentSessionIdRef.current = null
          activeProcessingPromiseRef.current = null
        } else {
          console.warn('[AutoTx] Different session already processing, skipping')
          return () => {
            isCancelled = true
            if (timeoutId) clearTimeout(timeoutId)
          }
        }
      } else {
        console.warn('[AutoTx] Processing flag set but no start time, resetting')
        isProcessingRef.current = false
        currentSessionIdRef.current = null
      }
    }

    const restored = restoreCache()
    if (!restored) {
      return () => {
        isCancelled = true
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    // Start processing this session
    isProcessingRef.current = true
    processingStartTimeRef.current = Date.now()
    currentSessionIdRef.current = sessionId

    if (onFormRestore) {
      onFormRestore(restored)
    }

    const storedJWT = getStoredJWT()
    if (!storedJWT) {
      console.log('[AutoTx] No stored JWT, clearing redirect params')
      clearRedirectParams()
      isProcessingRef.current = false
      processingStartTimeRef.current = null
      return () => {
        isCancelled = true
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    // Use chain slug from cache if available, otherwise fall back to prop
    const cachedChainSlug = getChainSlugFromCache ? getChainSlugFromCache(restored) : undefined
    const chainSlugToVerify = cachedChainSlug || expectedChainSlug

    const resetProcessing = () => {
      if (!isCancelled) {
        isProcessingRef.current = false
        processingStartTimeRef.current = null
        if (currentSessionIdRef.current === sessionId) {
          currentSessionIdRef.current = null
        }
        activeProcessingPromiseRef.current = null
      }
    }

    // First, decode the JWT to check the address without full verification
    fetch('/api/coinbase/verify-onramp-jwt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: storedJWT }),
    })
      .then((res) => {
        if (isCancelled) return null
        return res.json()
      })
      .then((data) => {
        if (isCancelled) return

        if (!data || !data.valid || !data.payload) {
          console.log('[AutoTx] JWT invalid or expired')
          clearJWT()
          clearRedirectParams()
          resetProcessing()
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
          resetProcessing()
          return
        }

        // Full verification
        return verifyJWT(storedJWT, currentAddress, undefined, context).then((payload) => {
          if (isCancelled) return

          if (!payload) {
            console.error('[AutoTx] JWT verification failed')
            clearJWT()
            clearRedirectParams()
            resetProcessing()
            return
          }

          if (payload.chainSlug !== chainSlugToVerify) {
            console.error('[AutoTx] JWT verification failed: chainSlug mismatch', {
              jwtChainSlug: payload.chainSlug,
              expectedChainSlug: chainSlugToVerify,
            })
            clearJWT()
            clearRedirectParams()
            resetProcessing()
            return
          }

          if (payload.context !== context) {
            console.error('[AutoTx] JWT verification failed: context mismatch', {
              jwtContext: payload.context,
              expectedContext: context,
            })
            clearJWT()
            clearRedirectParams()
            resetProcessing()
            return
          }

          console.log('[AutoTx] JWT verified successfully')

          // Store the expected address for verification during execution
          expectedAddressRef.current = payload.address

          // Restore wallet based on JWT payload if needed (multi-wallet support)
          if (payload.selectedWallet !== undefined && setSelectedWallet) {
            setSelectedWallet(payload.selectedWallet)
          }

          const proceed = shouldProceed ? shouldProceed(restored) : true
          if (proceed) {
            hasProcessedRef.current = true
            const processingPromise = new Promise<void>((resolve, reject) => {
              timeoutId = setTimeout(() => {
                if (isCancelled) {
                  resolve()
                  return
                }
                waitForReadyAndExecute()
                  .then(() => {
                    if (!isCancelled) {
                      clearRedirectParams()
                    }
                    resolve()
                  })
                  .catch((error) => {
                    if (!isCancelled) {
                      console.error('[AutoTx] Execution failed:', error)
                      hasProcessedRef.current = false
                    }
                    reject(error)
                  })
                  .finally(() => {
                    if (!isCancelled) {
                      resetProcessing()
                    }
                  })
              }, 1000)
            })
            activeProcessingPromiseRef.current = processingPromise
            processingPromise.finally(() => {
              if (activeProcessingPromiseRef.current === processingPromise) {
                activeProcessingPromiseRef.current = null
              }
            })
          } else {
            clearJWT()
            clearRedirectParams()
            resetProcessing()
          }
        })
      })
      .catch((error) => {
        if (isCancelled) return
        console.error('[AutoTx] Error checking JWT:', error)
        clearJWT()
        clearRedirectParams()
        resetProcessing()
      })

    // Cleanup function
    return () => {
      isCancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      // Only reset if we're still processing (don't reset if we've completed)
      if (isProcessingRef.current && !hasProcessedRef.current) {
        // Only reset if this cleanup is for the current session
        if (currentSessionIdRef.current === sessionId) {
          isProcessingRef.current = false
          processingStartTimeRef.current = null
          currentSessionIdRef.current = null
          activeProcessingPromiseRef.current = null
        }
      }
    }
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
