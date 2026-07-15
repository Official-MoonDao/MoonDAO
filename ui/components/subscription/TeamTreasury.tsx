import Image from 'next/image'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import { PROJECT_PENDING } from '@/lib/nance/types'
import { useENS } from '@/lib/utils/hooks/useENS'
import { useCitizenNameByAddress } from '@/lib/citizen/useCitizenNameByAddress'
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
  // Drop the inner "Treasury" title row when the parent already
  // provides one (e.g. a SectionCard on the proposal page). Keeps
  // the multisig address pill and action buttons so the call sites
  // on the team page — which wrap us in a plain styled `<div>` and
  // need our own title — are unaffected.
  hideHeader?: boolean
}

// The multisig address + Safe link + copy button. Pulled out so the
// hideHeader / default render paths share one source of truth, and so
// the markup doesn't shift around at the responsive breakpoints.
function MultisigAddressPill({ address }: { address: string }) {
  const safePrefix =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <a
        href={`https://app.safe.global/home?safe=${safePrefix}:${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors font-mono truncate"
      >
        {`${address.slice(0, 6)}...${address.slice(-4)}`}
      </a>
      <button
        type="button"
        className="text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-0 p-0 cursor-pointer flex-shrink-0"
        aria-label="Copy treasury address"
        onClick={() => {
          navigator.clipboard.writeText(address)
          toast.success('Treasury address copied to clipboard!')
        }}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  )
}

function SignerAddress({ address }: { address: string }) {
  const { data: ens } = useENS(address)
  const citizenName = useCitizenNameByAddress(address)
  const displayName =
    citizenName || ens?.name || `${address.slice(0, 6)}...${address.slice(-4)}`
  return (
    <a
      href={`https://etherscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
    >
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0" />
      <span className={`text-xs sm:text-sm truncate ${citizenName ? 'text-white font-medium' : 'text-gray-300 font-mono'}`}>
        {displayName}
      </span>
    </a>
  )
}

export default function TeamTreasury({
  isSigner,
  safeData,
  multisigAddress,
  safeOwners,
  projectActive,
  hideHeader = false,
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
      <div className="w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6">
        {safeOwners.length < 5 && projectActive === PROJECT_PENDING && (
          <div className="p-3 sm:p-4 bg-yellow-900/30 border border-yellow-500/40 rounded-xl">
            <div className="flex items-start gap-2 sm:gap-3">
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
              <div className="min-w-0">
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
        {/* Header row layout strategy:
            - Mobile (default): everything stacks. Title on one line,
              multisig pill on the next, then a 3-up button grid.
            - sm (640+): title and multisig pill share a row; buttons
              still wrap below as a flex row.
            - xl (1280+): the entire header collapses to one row with
              `justify-between`. We stop short of `lg` because at the
              lg breakpoint this card is sometimes mounted in a
              ~600px-wide grid column (e.g. col-span-2 of 3 on the
              proposal page) where a horizontal layout fights for
              space with the action buttons. `flex-wrap` is on the
              row so even when xl kicks in, narrow viewports still
              wrap gracefully instead of overflowing. */}
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between xl:gap-5">
          {!hideHeader && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 sm:items-center min-w-0">
              <div className="flex gap-3 sm:gap-5 items-center min-w-0">
                <Image
                  src="/assets/icon-star.svg"
                  alt="Treasury icon"
                  width={30}
                  height={30}
                  className="opacity-70 flex-shrink-0"
                />
                <h2 className="font-GoodTimes text-xl sm:text-2xl text-white truncate">
                  Treasury
                </h2>
              </div>
              {multisigAddress && (
                <MultisigAddressPill address={multisigAddress} />
              )}
            </div>
          )}
          {hideHeader && multisigAddress && (
            <div className="flex items-center min-w-0">
              <MultisigAddressPill address={multisigAddress} />
            </div>
          )}
          {safeData && isSigner && (
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <StandardButton
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl py-2 px-3 sm:px-5 text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeSendModalEnabled(true)
                }}
              >
                {'Send'}
              </StandardButton>
              <StandardButton
                className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl py-2 px-3 sm:px-5 text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setSafeReceiveModalEnabled(true)
                }}
              >
                {'Receive'}
              </StandardButton>
              <StandardButton
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl py-2 px-3 sm:px-5 text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105"
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
