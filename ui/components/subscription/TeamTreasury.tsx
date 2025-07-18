import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import StandardButton from '../layout/StandardButton'
import SafeBalances from '../safe/SafeBalances'
import SafeModal from '../safe/SafeModal'
import SafeReceiveModal from '../safe/SafeReceiveModal'
import SafeSendModal from '../safe/SafeSendModal'
import SafeTransactions from '../safe/SafeTransactions'

type TeamTreasuryProps = {
  isSigner: boolean
  safeData: any
  multisigAddress: string
  safeOwners: string[]
}

export default function TeamTreasury({
  isSigner,
  safeData,
  multisigAddress,
}: TeamTreasuryProps) {
  const account = useActiveAccount()
  const address = account?.address
  const [safeModalEnabled, setSafeModalEnabled] = useState(false)
  const [safeSendModalEnabled, setSafeSendModalEnabled] = useState(false)
  const [safeReceiveModalEnabled, setSafeReceiveModalEnabled] = useState(false)

  const { data: safeBalances, isLoading: isLoadingBalances } = useSafeBalances(
    multisigAddress,
    !!multisigAddress,
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia',
    5000
  )

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-24 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      {safeModalEnabled && isSigner && (
        <SafeModal
          safeData={safeData}
          safeAddress={multisigAddress}
          isEnabled={safeModalEnabled}
          setEnabled={setSafeModalEnabled}
        />
      )}
      {safeReceiveModalEnabled && isSigner && (
        <SafeReceiveModal
          safeAddress={multisigAddress}
          setEnabled={setSafeReceiveModalEnabled}
        />
      )}
      {safeSendModalEnabled && isSigner && (
        <SafeSendModal
          safeData={safeData}
          safeAddress={multisigAddress}
          setEnabled={setSafeSendModalEnabled}
        />
      )}
      <div className="flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center pr-12">
          <div className="flex gap-5 opacity-[50%]">
            <Image
              src={'/assets/icon-treasury.svg'}
              alt="Treasury icon"
              width={30}
              height={30}
            />
            <h2 className="header font-GoodTimes">Treasury</h2>
          </div>
          {safeData && isSigner && (
            <div className="flex flex-col md:flex-row md:flex-wrap gap-2">
              <StandardButton
                className="min-w-[200px] gradient-2 rounded-[5vmax]"
                onClick={() => {
                  setSafeSendModalEnabled(true)
                }}
              >
                {'Send'}
              </StandardButton>
              <StandardButton
                className="min-w-[200px] gradient-2 rounded-[5vmax]"
                onClick={() => {
                  setSafeReceiveModalEnabled(true)
                }}
              >
                {'Receive'}
              </StandardButton>
              <StandardButton
                className="min-w-[200px] gradient-2 rounded-[5vmax]"
                onClick={() => {
                  setSafeModalEnabled(true)
                }}
              >
                {'Manage'}
              </StandardButton>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4"></div>
        <SafeBalances
          safeBalances={safeBalances}
          isLoading={isLoadingBalances}
        />

        {isSigner && (
          <div className="mt-4 ml-4">
            <SafeTransactions address={address} safeData={safeData} />
          </div>
        )}
      </div>
    </div>
  )
}
