import { useEffect, useCallback } from 'react'
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
  maxAttempts?: number
  delayMs?: number
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
  maxAttempts = 10,
  delayMs = 1000,
}: UseOnrampAutoTransactionOptions) {
  const { isReturningFromOnramp, clearRedirectParams } = useOnrampRedirect()
  const { verifyJWT, getStoredJWT, clearJWT } = useOnrampJWT()

  const pollBalanceAndExecute = useCallback(async () => {
    // In mock mode, skip balance polling and execute immediately
    if (MOCK_ONRAMP) {
      await onTransaction()
      clearJWT()
      return
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await refetchNativeBalance()
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      try {
        const isSufficient = await checkBalanceSufficient()
        if (isSufficient) {
          await onTransaction()
          clearJWT()
          return
        }
      } catch (error) {
        console.error('Error checking balance:', error)
      }
    }

    await onTransaction()
    clearJWT()
  }, [maxAttempts, delayMs, refetchNativeBalance, checkBalanceSufficient, onTransaction, clearJWT])

  useEffect(() => {
    if (!isReturningFromOnramp || !address || !onTransaction) {
      return
    }

    const restored = restoreCache()
    if (!restored) {
      clearRedirectParams()
      return
    }

    const storedJWT = getStoredJWT()
    if (!storedJWT) {
      clearRedirectParams()
      return
    }

    // Use chain slug from cache if available, otherwise fall back to prop
    const cachedChainSlug = getChainSlugFromCache
      ? getChainSlugFromCache(restored)
      : undefined
    const chainSlugToVerify = cachedChainSlug || expectedChainSlug

    verifyJWT(storedJWT, address, undefined, context).then((payload) => {
      if (
        !payload ||
        payload.address.toLowerCase() !== address.toLowerCase() ||
        payload.chainSlug !== chainSlugToVerify ||
        payload.context !== context
      ) {
        clearJWT()
        clearRedirectParams()
        return
      }

      if (onFormRestore) {
        onFormRestore(restored)
      }

      clearRedirectParams()

      const proceed = shouldProceed ? shouldProceed(restored) : true
      if (proceed) {
        setTimeout(() => {
          pollBalanceAndExecute()
        }, 1000)
      } else {
        clearJWT()
      }
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
    onTransaction,
    pollBalanceAndExecute,
    getChainSlugFromCache,
  ])
}
