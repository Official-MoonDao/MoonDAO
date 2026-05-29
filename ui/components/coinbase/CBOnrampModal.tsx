import { DEPLOYED_ORIGIN } from 'const/config'
import { useRouter } from 'next/router'
import React, { useCallback, useMemo } from 'react'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import useOnrampRegion, { shouldUseHeadlessOnramp } from '@/lib/coinbase/useOnrampRegion'
import { getChainSlug } from '@/lib/thirdweb/chain'
import Modal from '../layout/Modal'
import { CBHeadlessOnramp } from './CBHeadlessOnramp'
import { CBOnramp } from './CBOnramp'

interface CBOnrampModalProps {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  address: string
  selectedChain: any
  ethAmount: number
  redirectUrl?: string
  onExit?: () => void
  onBeforeNavigate?: () => Promise<void>
  isWaitingForGasEstimate?: boolean
  allowAmountInput?: boolean
  context: string
  agreed?: boolean
  selectedWallet?: number
  onQuoteCalculated?: (
    ethAmount: number,
    paymentSubtotal: number,
    paymentTotal: number,
    totalFees: number
  ) => void
}

export const CBOnrampModal: React.FC<CBOnrampModalProps> = ({
  enabled,
  setEnabled,
  address,
  selectedChain,
  ethAmount,
  redirectUrl,
  onExit,
  onBeforeNavigate,
  isWaitingForGasEstimate = false,
  allowAmountInput = false,
  context,
  agreed,
  selectedWallet,
  onQuoteCalculated,
}) => {
  const router = useRouter()
  const { generateJWT } = useOnrampJWT()
  const { isUS, isLoading: isLoadingRegion } = useOnrampRegion()
  const chainSlug = getChainSlug(selectedChain)
  const useHeadless = shouldUseHeadlessOnramp(isUS)

  const generateRedirectUrl = useCallback(() => {
    if (redirectUrl) {
      return redirectUrl
    }

    const currentPath = router.asPath ? router.asPath.split('?')[0] : '/'
    const currentQuery = { ...router.query }
    currentQuery.onrampSuccess = 'true'

    const queryString = new URLSearchParams(
      Object.entries(currentQuery).reduce((acc, [key, value]) => {
        // Filter out Privy OAuth params
        if (key.startsWith('privy_')) {
          return acc
        }
        if (value !== undefined && value !== null) {
          acc[key] = String(value)
        }
        return acc
      }, {} as Record<string, string>)
    ).toString()

    return `${DEPLOYED_ORIGIN}${currentPath}${queryString ? `?${queryString}` : ''}`
  }, [router, redirectUrl])

  const handleExit = useCallback(() => {
    onExit?.()
    setEnabled(false)
  }, [onExit, setEnabled])

  const finalRedirectUrl = useMemo(() => generateRedirectUrl(), [generateRedirectUrl])

  // Generate JWT before navigating to onramp
  const handleBeforeNavigate = useCallback(async () => {
    // Generate JWT with context and current state
    await generateJWT({
      address,
      chainSlug,
      agreed,
      context,
      selectedWallet,
    })

    // Call original onBeforeNavigate if provided
    try {
      await onBeforeNavigate?.()
    } catch (error) {
      console.error('[CBOnrampModal] onBeforeNavigate failed:', error)
      throw error
    }
  }, [address, chainSlug, agreed, context, selectedWallet, generateJWT, onBeforeNavigate])

  /**
   * Headless flow synthesizes the same signal the legacy redirect flow uses:
   *  - the JWT was already written by `handleBeforeNavigate`
   *  - we add `?onrampSuccess=true` to the URL via shallow router replace
   *  - close the modal
   * The existing `useOnrampAutoTransaction` hook in consumers fires identically,
   * so no consumer code needs to change.
   */
  const handleHeadlessSuccess = useCallback(async () => {
    try {
      const nextQuery = { ...router.query, onrampSuccess: 'true' }
      await router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true }
      )
    } catch (error) {
      console.error('[CBOnrampModal] failed to push onrampSuccess flag', error)
    } finally {
      setEnabled(false)
    }
  }, [router, setEnabled])

  /** Stable per-user identifier for Coinbase partnerUserRef */
  const partnerUserRef = useMemo(() => {
    const ctx = context || 'onramp'
    return `${ctx}-${address || 'anon'}`.toLowerCase()
  }, [context, address])

  if (!enabled) {
    return null
  }

  return (
    <Modal
      id="cbonramp-modal"
      setEnabled={setEnabled}
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[9999] overflow-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn"
      showCloseButton={false}
    >
      {isLoadingRegion ? (
        // Brief loading shell while we determine US vs non-US so the user
        // doesn't briefly see the legacy flow before being swapped to headless.
        <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center text-gray-300">
          Loading payment options...
        </div>
      ) : useHeadless ? (
        <CBHeadlessOnramp
          address={address}
          selectedChain={selectedChain}
          ethAmount={ethAmount}
          partnerUserRef={partnerUserRef}
          onExit={handleExit}
          onBeforeNavigate={handleBeforeNavigate}
          onPaymentSuccess={handleHeadlessSuccess}
          isWaitingForGasEstimate={isWaitingForGasEstimate}
          allowAmountInput={allowAmountInput}
          onQuoteCalculated={onQuoteCalculated}
        />
      ) : (
        <CBOnramp
          address={address}
          selectedChain={selectedChain}
          ethAmount={ethAmount}
          redirectUrl={finalRedirectUrl}
          onExit={handleExit}
          onBeforeNavigate={handleBeforeNavigate}
          isWaitingForGasEstimate={isWaitingForGasEstimate}
          allowAmountInput={allowAmountInput}
          onQuoteCalculated={onQuoteCalculated}
        />
      )}
    </Modal>
  )
}
