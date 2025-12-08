import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import Button from '../layout/Button'
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

export default function TeamTreasury({ isSigner, safeData, multisigAddress }: TeamTreasuryProps) {
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
    <>
      {safeModalEnabled && isSigner && (
        <SafeModal
          safeData={safeData}
          safeAddress={multisigAddress}
          isEnabled={safeModalEnabled}
          setEnabled={setSafeModalEnabled}
        />
      )}
      {safeReceiveModalEnabled && isSigner && (
        <SafeReceiveModal safeAddress={multisigAddress} setEnabled={setSafeReceiveModalEnabled} />
      )}
      {safeSendModalEnabled && isSigner && (
        <SafeSendModal
          safeData={safeData}
          safeAddress={multisigAddress}
          setEnabled={setSafeSendModalEnabled}
        />
      )}
      <section className="p-6">
        <div className="w-full flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center">
            <div
              className="flex gap-5"
              onClick={() => {
                navigator.clipboard.writeText(multisigAddress)
                toast.success('Address copied to clipboard.')
              }}
            >
              <Image
                src={'/assets/icon-treasury.svg'}
                alt="Treasury icon"
                width={30}
                height={30}
                className="opacity-70"
              />
              <h2 className="font-GoodTimes text-2xl text-white">
                Treasury
                {multisigAddress &&
                  ` ${multisigAddress.slice(0, 6)}...${multisigAddress.slice(-4)}`}
              </h2>
            </div>
            {safeData && isSigner && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  borderRadius="rounded-xl"
                  className="text-white font-semibold hover:scale-105"
                  onClick={() => {
                    setSafeSendModalEnabled(true)
                  }}
                >
                  {'Send'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  borderRadius="rounded-xl"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold hover:scale-105"
                  onClick={() => {
                    setSafeReceiveModalEnabled(true)
                  }}
                >
                  {'Receive'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  borderRadius="rounded-xl"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold hover:scale-105"
                  onClick={() => {
                    setSafeModalEnabled(true)
                  }}
                >
                  {'Manage'}
                </Button>
              </div>
            )}
          </div>
          <SafeBalances safeBalances={safeBalances} isLoading={isLoadingBalances} />

          {isSigner && safeData && (
            <div className="mt-4 pt-4 border-t border-slate-600/30">
              <SafeTransactions address={address} safeData={safeData} />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
