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
    <div className="w-full p-6">
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
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-6">
          <div className="flex gap-5">
            <Image
              src={'/assets/icon-treasury.svg'}
              alt="Treasury icon"
              width={30}
              height={30}
              className="opacity-70"
            />
            <h2 className="font-GoodTimes text-2xl text-white">Treasury</h2>
          </div>
          {safeData && isSigner && (
            <div className="flex flex-col sm:flex-row gap-3">
              <StandardButton
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl py-3 px-6 font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeSendModalEnabled(true)
                }}
              >
                {'Send'}
              </StandardButton>
              <StandardButton
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl py-3 px-6 font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeReceiveModalEnabled(true)
                }}
              >
                {'Receive'}
              </StandardButton>
              <StandardButton
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl py-3 px-6 font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeModalEnabled(true)
                }}
              >
                {'Manage'}
              </StandardButton>
            </div>
          )}
        </div>
        <div className="mt-4">
          <SafeBalances
            safeBalances={safeBalances}
            isLoading={isLoadingBalances}
          />
        </div>

        {isSigner && (
          <div className="mt-6">
            <SafeTransactions address={address} safeData={safeData} />
          </div>
        )}
      </div>
    </div>
  )
}
