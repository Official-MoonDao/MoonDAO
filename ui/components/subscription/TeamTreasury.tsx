import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import { useENS } from '@/lib/utils/hooks/useENS'
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

function SignerAddress({ address }: { address: string }) {
  const { data: ens } = useENS(address)
  return (
    <a
      href={`https://etherscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
    >
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0" />
      <span className="text-sm text-gray-300 font-mono">
        {ens?.name || `${address.slice(0, 6)}...${address.slice(-4)}`}
      </span>
    </a>
  )
}

export default function TeamTreasury({ isSigner, safeData, multisigAddress, safeOwners }: TeamTreasuryProps) {
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
      <div className="w-full flex flex-col gap-5 p-6">
        <div className="flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center">
          <div className="flex gap-5 items-center">
            <Image
              src="/assets/icon-star.svg"
              alt="Treasury icon"
              width={30}
              height={30}
              className="opacity-70"
            />
            <h2 className="font-GoodTimes text-2xl text-white">Treasury</h2>
            <button
              type="button"
              className="text-sm text-slate-400 cursor-pointer hover:text-slate-200 transition-colors bg-transparent border-0 p-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Copy treasury address"
              onClick={() => {
                navigator.clipboard.writeText(multisigAddress)
                toast.success('Address copied to clipboard.')
              }}
            >
              {multisigAddress &&
                `${multisigAddress.slice(0, 6)}...${multisigAddress.slice(-4)}`}
            </button>
          </div>
          {safeData && isSigner && (
            <div className="flex flex-col sm:flex-row gap-3">
              <StandardButton
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl py-2 px-5 text-sm font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeSendModalEnabled(true)
                }}
              >
                {'Send'}
              </StandardButton>
              <StandardButton
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl py-2 px-5 text-sm font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeReceiveModalEnabled(true)
                }}
              >
                {'Receive'}
              </StandardButton>
              <StandardButton
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl py-2 px-5 text-sm font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeModalEnabled(true)
                }}
              >
                {'Manage'}
              </StandardButton>
            </div>
          )}
        </div>
        <SafeBalances safeBalances={safeBalances} isLoading={isLoadingBalances} />

        {safeOwners && safeOwners.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-600/30">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Signers ({safeOwners.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {safeOwners.map((owner) => (
                <SignerAddress key={owner} address={owner} />
              ))}
            </div>
          </div>
        )}

        {isSigner && safeData && (
          <div className="mt-4 pt-4 border-t border-slate-600/30">
            <SafeTransactions address={address} safeData={safeData} />
          </div>
        )}
      </div>
    </>
  )
}
