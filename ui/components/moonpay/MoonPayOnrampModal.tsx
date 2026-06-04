import React from 'react'
import Modal from '../layout/Modal'
import { MoonPayOnramp } from './MoonPayOnramp'

interface MoonPayOnrampModalProps {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  address: string
  selectedChain: any
  ethAmount: number
  onExit?: () => void
  /** Called just before the MoonPay widget opens */
  onBeforeOpen?: () => Promise<void>
  /** Called when MoonPay widget closes (purchase submitted) */
  onPurchaseSubmitted?: () => void
  isWaitingForGasEstimate?: boolean
  /** Optional: poll balance and auto-proceed when sufficient */
  checkBalanceSufficient?: () => Promise<boolean>
  onBalanceSufficient?: () => void
  /** Milliseconds between balance polls. Default: 15000 */
  pollIntervalMs?: number
  /** Minutes to keep polling. Default: 30 */
  pollMaxMinutes?: number
}

export const MoonPayOnrampModal: React.FC<MoonPayOnrampModalProps> = ({
  enabled,
  setEnabled,
  address,
  selectedChain,
  ethAmount,
  onExit,
  onBeforeOpen,
  onPurchaseSubmitted,
  isWaitingForGasEstimate = false,
  checkBalanceSufficient,
  onBalanceSufficient,
  pollIntervalMs,
  pollMaxMinutes,
}) => {
  const handleExit = () => {
    onExit?.()
    setEnabled(false)
  }

  if (!enabled) return null

  return (
    <Modal
      id="moonpay-onramp-modal"
      setEnabled={setEnabled}
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[9999] overflow-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn"
      showCloseButton={false}
    >
      <MoonPayOnramp
        address={address}
        selectedChain={selectedChain}
        ethAmount={ethAmount}
        onExit={handleExit}
        onBeforeOpen={onBeforeOpen}
        onPurchaseSubmitted={onPurchaseSubmitted}
        isWaitingForGasEstimate={isWaitingForGasEstimate}
        checkBalanceSufficient={checkBalanceSufficient}
        onBalanceSufficient={onBalanceSufficient}
        pollIntervalMs={pollIntervalMs}
        pollMaxMinutes={pollMaxMinutes}
      />
    </Modal>
  )
}
