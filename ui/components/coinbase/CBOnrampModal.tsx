import { DEPLOYED_ORIGIN } from 'const/config'
import { useRouter } from 'next/router'
import React, { useCallback, useMemo } from 'react'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import { getChainSlug } from '@/lib/thirdweb/chain'
import Modal from '../layout/Modal'
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
  const chainSlug = getChainSlug(selectedChain)

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
    console.log('[CBOnrampModal] handleBeforeNavigate called with agreed:', agreed)
    // Generate JWT with context and current state
    await generateJWT({
      address,
      chainSlug,
      agreed,
      context,
      selectedWallet,
    })
    console.log('[CBOnrampModal] JWT generated, calling original onBeforeNavigate')

    // Call original onBeforeNavigate if provided
    try {
      await onBeforeNavigate?.()
      console.log('[CBOnrampModal] Original onBeforeNavigate completed')
    } catch (error) {
      console.error('[CBOnrampModal] Original onBeforeNavigate failed:', error)
      throw error
    }
  }, [address, chainSlug, agreed, context, selectedWallet, generateJWT, onBeforeNavigate])

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
    </Modal>
  )
}
