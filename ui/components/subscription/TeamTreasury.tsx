import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import { PROJECT_PENDING } from '@/lib/nance/types'
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
  projectActive?: number
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
      <span className="text-xs sm:text-sm text-gray-300 font-mono truncate">
        {ens?.name || `${address.slice(0, 6)}...${address.slice(-4)}`}
      </span>
    </a>
  )
}

export default function TeamTreasury({ isSigner, safeData, multisigAddress, safeOwners, projectActive }: TeamTreasuryProps) {
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
      <div className="w-full flex flex-col gap-4 sm:gap-5 p-0 sm:p-6">
        {safeOwners.length < 5 && projectActive === PROJECT_PENDING && (
          <div className="p-4 bg-yellow-900/30 border border-yellow-500/40 rounded-xl">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <p className="text-sm text-yellow-200 font-medium">
                  Multisig Setup Required
                </p>
                <p className="text-xs text-yellow-200/70 mt-1">
                  This project&apos;s multisig currently has {safeOwners.length} signer
                  {safeOwners.length === 1 ? '' : 's'}. Projects must have a 3/5 multisig
                  (5 signers with a threshold of 3) to be included in the member vote.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-5 lg:justify-between lg:items-center">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 sm:items-center">
            <div className="flex gap-3 sm:gap-5 items-center">
              <Image
                src="/assets/icon-star.svg"
                alt="Treasury icon"
                width={30}
                height={30}
                className="opacity-70"
              />
              <h2 className="font-GoodTimes text-xl sm:text-2xl text-white">Treasury</h2>
            </div>
            {multisigAddress && (
              <div className="flex items-center gap-2">
                <a
                  href={`https://app.safe.global/home?safe=${
                    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                  }:${multisigAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors font-mono"
                >
                  {`${multisigAddress.slice(0, 6)}...${multisigAddress.slice(-4)}`}
                </a>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-0 p-0 cursor-pointer"
                  aria-label="Copy treasury address"
                  onClick={() => {
                    navigator.clipboard.writeText(multisigAddress)
                    toast.success('Address copied to clipboard.')
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            )}
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
