import { DEPLOYED_ORIGIN } from 'const/config'
import { useRouter } from 'next/router'
import React, { useCallback, useMemo } from 'react'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import { getChainSlug } from '@/lib/thirdweb/chain'
import Modal from '../layout/Modal'
import { FundOnramp, OnrampProvider } from './FundOnramp'

interface FundOnrampModalProps {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  address: string
  selectedChain: any
  ethAmount: number
  onExit?: () => void
  isWaitingForGasEstimate?: boolean
  defaultProvider?: OnrampProvider

  // Coinbase (redirect flow + JWT for post-redirect auto-transaction)
  context: string
  agreed?: boolean
  selectedWallet?: number
  redirectUrl?: string
  onBeforeNavigate?: () => Promise<void>
  allowAmountInput?: boolean
  onQuoteCalculated?: (
    ethAmount: number,
    paymentSubtotal: number,
    paymentTotal: number,
    totalFees: number
  ) => void

  // MoonPay (on-page balance polling)
  onMoonPayBeforeOpen?: () => Promise<void>
  onMoonPayPurchaseSubmitted?: () => void
  checkBalanceSufficient?: () => Promise<boolean>
  onBalanceSufficient?: () => void
  refetchBalance?: () => Promise<void>
  pollIntervalMs?: number
  pollMaxMinutes?: number
}

export const FundOnrampModal: React.FC<FundOnrampModalProps> = ({
  enabled,
  setEnabled,
  address,
  selectedChain,
  ethAmount,
  onExit,
  isWaitingForGasEstimate = false,
  defaultProvider = 'moonpay',
  context,
  agreed,
  selectedWallet,
  redirectUrl,
  onBeforeNavigate,
  allowAmountInput = false,
  onQuoteCalculated,
  onMoonPayBeforeOpen,
  onMoonPayPurchaseSubmitted,
  checkBalanceSufficient,
  onBalanceSufficient,
  refetchBalance,
  pollIntervalMs,
  pollMaxMinutes,
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

  const finalRedirectUrl = useMemo(() => generateRedirectUrl(), [generateRedirectUrl])

  const handleExit = useCallback(() => {
    onExit?.()
    setEnabled(false)
  }, [onExit, setEnabled])

  // Generate JWT before navigating to the Coinbase onramp so the
  // post-redirect auto-transaction flow can resume on return.
  const handleCoinbaseBeforeNavigate = useCallback(async () => {
    await generateJWT({
      address,
      chainSlug,
      agreed,
      context,
      selectedWallet,
    })

    try {
      await onBeforeNavigate?.()
    } catch (error) {
      console.error('[FundOnrampModal] onBeforeNavigate failed:', error)
      throw error
    }
  }, [address, chainSlug, agreed, context, selectedWallet, generateJWT, onBeforeNavigate])

  if (!enabled) {
    return null
  }

  return (
    <Modal
      id="fund-onramp-modal"
      setEnabled={setEnabled}
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[9999] overflow-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn"
      showCloseButton={false}
    >
      <FundOnramp
        address={address}
        selectedChain={selectedChain}
        ethAmount={ethAmount}
        isWaitingForGasEstimate={isWaitingForGasEstimate}
        onExit={handleExit}
        defaultProvider={defaultProvider}
        allowAmountInput={allowAmountInput}
        coinbaseRedirectUrl={finalRedirectUrl}
        onCoinbaseBeforeNavigate={handleCoinbaseBeforeNavigate}
        onCoinbaseQuoteCalculated={onQuoteCalculated}
        onMoonPayBeforeOpen={onMoonPayBeforeOpen}
        onMoonPayPurchaseSubmitted={onMoonPayPurchaseSubmitted}
        checkBalanceSufficient={checkBalanceSufficient}
        onBalanceSufficient={onBalanceSufficient}
        refetchBalance={refetchBalance}
        pollIntervalMs={pollIntervalMs}
        pollMaxMinutes={pollMaxMinutes}
      />
    </Modal>
  )
}
