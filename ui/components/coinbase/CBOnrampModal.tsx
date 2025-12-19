import { DEPLOYED_ORIGIN } from 'const/config'
import { useRouter } from 'next/router'
import React, { useCallback, useMemo, useEffect } from 'react'
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
    })

    // Call original onBeforeNavigate if provided
    await onBeforeNavigate?.()
  }, [address, chainSlug, agreed, context, generateJWT, onBeforeNavigate])

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
