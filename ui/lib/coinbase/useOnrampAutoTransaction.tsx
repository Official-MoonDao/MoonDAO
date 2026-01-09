import { useEffect, useCallback, useRef } from 'react'
import useOnrampJWT from './useOnrampJWT'
import { useOnrampRedirect } from './useOnrampRedirect'

const MOCK_ONRAMP = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000

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

  const addressRef = useRef(address)
  useEffect(() => {
    addressRef.current = address
  }, [address])

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  const onTransactionRef = useRef(onTransaction)
  useEffect(() => {
    onTransactionRef.current = onTransaction
  }, [onTransaction])

  const waitForReadyRef = useRef(waitForReady)
  useEffect(() => {
    waitForReadyRef.current = waitForReady
  }, [waitForReady])

  const expectedAddressRef = useRef<string | null>(null)
  const isProcessingRef = useRef(false)
  const hasProcessedRef = useRef(false)
  const prevIsReturningFromOnrampRef = useRef(false)
  const processingStartTimeRef = useRef<number | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const activeProcessingPromiseRef = useRef<Promise<void> | null>(null)

  const clearExpectedAddress = useCallback(() => {
    expectedAddressRef.current = null
  }, [])

  const pollBalanceAndExecute = useCallback(async () => {
    if (expectedAddressRef.current && addressRef.current) {
      if (addressRef.current.toLowerCase() !== expectedAddressRef.current.toLowerCase()) {
        console.error('Address mismatch during execution')
        clearJWT()
        clearExpectedAddress()
        clearRedirectParams()
        hasProcessedRef.current = false
        return
      }
    }

    if (MOCK_ONRAMP) {
      try {
        await onTransactionRef.current()
        clearJWT()
        clearExpectedAddress()
        clearRedirectParams()
      } catch (error) {
        console.error('Transaction failed:', error)
        hasProcessedRef.current = false
        throw error
      }
      return
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
            console.error('Transaction failed:', error)
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
      console.error('Final transaction attempt failed:', error)
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
      if (expectedAddressRef.current && addressRef.current) {
        if (addressRef.current.toLowerCase() !== expectedAddressRef.current.toLowerCase()) {
          console.error('Address changed while waiting for ready')
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

    if (prevIsReturningFromOnrampRef.current && !isReturningFromOnramp) {
      hasProcessedRef.current = false
      isProcessingRef.current = false
      processingStartTimeRef.current = null
      currentSessionIdRef.current = null
      activeProcessingPromiseRef.current = null
    }

    if (isReturningFromOnramp && address && !currentSessionIdRef.current) {
      currentSessionIdRef.current = `${address}-${Date.now()}`
    }

    const sessionId = currentSessionIdRef.current
    prevIsReturningFromOnrampRef.current = isReturningFromOnramp

    if (isProcessingRef.current && processingStartTimeRef.current) {
      const elapsed = Date.now() - processingStartTimeRef.current
      if (elapsed > PROCESSING_TIMEOUT_MS) {
        console.warn('Processing timeout, resetting state')
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
      }
    }

    if (!isReturningFromOnramp || !address || !onTransactionRef.current || !sessionId) {
      return () => {
        isCancelled = true
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current)
          timeoutIdRef.current = null
        }
      }
    }

    if (currentSessionIdRef.current === sessionId && isProcessingRef.current) {
      if (activeProcessingPromiseRef.current) {
        return () => {
          isCancelled = true
        }
      } else {
        isProcessingRef.current = false
        currentSessionIdRef.current = null
      }
    }

    if (isProcessingRef.current && currentSessionIdRef.current !== sessionId) {
      if (processingStartTimeRef.current) {
        const elapsed = Date.now() - processingStartTimeRef.current
        if (elapsed > 30000) {
          isProcessingRef.current = false
          processingStartTimeRef.current = null
          currentSessionIdRef.current = null
          activeProcessingPromiseRef.current = null
        } else {
          return () => {
            isCancelled = true
            if (timeoutId) clearTimeout(timeoutId)
          }
        }
      } else {
        isProcessingRef.current = false
        currentSessionIdRef.current = null
      }
    }

    const processCacheAndContinue = (cache: any) => {
      if (isCancelled) return

      // Ensure cache has proper structure
      if (!cache) {
        console.error('[useOnrampAutoTransaction] Cache is null or undefined')
        return
      }

      // Normalize cache structure if needed (handle old format)
      if (!cache.formData && (cache.citizenData || cache.stage !== undefined)) {
        const { stage, timestamp, contextId: oldContextId, ...formData } = cache
        cache = {
          stage,
          formData: formData,
          timestamp: timestamp || Date.now(),
          contextId: oldContextId,
        }
        console.log('[useOnrampAutoTransaction] Normalized cache structure')
      }

      if (!cache.formData) {
        console.error('[useOnrampAutoTransaction] Cache missing formData structure', cache)
        return
      }

      isProcessingRef.current = true
      processingStartTimeRef.current = Date.now()
      currentSessionIdRef.current = sessionId

      if (onFormRestore) {
        onFormRestore(cache)
      }

      const storedJWT = getStoredJWT()
      const isMockMode = process.env.NEXT_PUBLIC_MOCK_ONRAMP === 'true'

      if (!storedJWT) {
        if (isMockMode) {
          // Continue with auto-transaction in mock mode
        } else {
          isProcessingRef.current = false
          processingStartTimeRef.current = null
          return
        }
      }

      const cachedChainSlug = getChainSlugFromCache ? getChainSlugFromCache(cache) : undefined
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

      const executeAutoTransaction = () => {
        const proceed = shouldProceed ? shouldProceed(cache) : true

        if (proceed) {
          hasProcessedRef.current = true
          isProcessingRef.current = true
          processingStartTimeRef.current = Date.now()

          const processingPromise = new Promise<void>((resolve, reject) => {
            timeoutIdRef.current = setTimeout(() => {
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
                    console.error('Execution failed:', error)
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
      }

      if (isMockMode) {
        expectedAddressRef.current = addressRef.current || ''
        executeAutoTransaction()
        return
      }

      if (!storedJWT) {
        resetProcessing()
        return
      }

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
            clearJWT()
            clearRedirectParams()
            resetProcessing()
            return
          }

          const jwtPayload = data.payload
          const currentAddress = addressRef.current

          if (
            !currentAddress ||
            jwtPayload.address.toLowerCase() !== currentAddress.toLowerCase()
          ) {
            if (jwtPayload.selectedWallet !== undefined && setSelectedWallet) {
              setSelectedWallet(jwtPayload.selectedWallet)
            }
            resetProcessing()
            return
          }

          return verifyJWT(storedJWT, currentAddress, undefined, context).then((payload) => {
            if (isCancelled) return

            if (!payload) {
              console.error('JWT verification failed')
              clearJWT()
              clearRedirectParams()
              resetProcessing()
              return
            }

            if (payload.chainSlug !== chainSlugToVerify) {
              console.error('JWT verification failed: chainSlug mismatch')
              clearJWT()
              clearRedirectParams()
              resetProcessing()
              return
            }

            if (payload.context !== context) {
              console.error('JWT verification failed: context mismatch')
              clearJWT()
              clearRedirectParams()
              resetProcessing()
              return
            }

            expectedAddressRef.current = payload.address

            if (payload.selectedWallet !== undefined && setSelectedWallet) {
              setSelectedWallet(payload.selectedWallet)
            }

            executeAutoTransaction()
          })
        })
        .catch((error) => {
          if (isCancelled) return
          console.error('Error checking JWT:', error)
          clearJWT()
          clearRedirectParams()
          resetProcessing()
        })
    }

    let timeoutId: NodeJS.Timeout | null = null

    const initialDelay = setTimeout(() => {
      if (isCancelled) return

      let restored = restoreCache()

      if (!restored) {
        const delayedCheck = setTimeout(() => {
          if (isCancelled) return
          const retryRestored = restoreCache()
          if (!retryRestored) {
            return
          }
          processCacheAndContinue(retryRestored)
        }, 100)

        timeoutId = delayedCheck
        return
      }

      processCacheAndContinue(restored)
    }, 50)

    return () => {
      isCancelled = true

      clearTimeout(initialDelay)
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (timeoutIdRef.current && !isProcessingRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }

      if (isProcessingRef.current && !hasProcessedRef.current) {
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
