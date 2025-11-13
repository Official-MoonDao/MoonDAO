import {
  WalletIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BanknotesIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'
import { useFundWallet } from '@privy-io/react-auth'
import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import StandardButton from '@/components/layout/StandardButton'

type WalletInfoCardProps = {
  unlockedMooney?: number | null
  lockedMooney?: number | null
  totalVMOONEY?: number | null
  votingPower?: number | null
  isUnlockedLoading?: boolean
  isLockedLoading?: boolean
  isVMOONEYLoading?: boolean
  isVotingPowerLoading?: boolean
}

function formatToken(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0.00'
  if (value === 0) return '0.00'
  if (value < 0.01) return '<0.01'
  if (value < 1000) return value.toFixed(2)
  if (value < 1000000) return `${(value / 1000).toFixed(1)}K`
  return `${(value / 1000000).toFixed(1)}M`
}

export default function WalletInfoCard({
  unlockedMooney,
  lockedMooney,
  totalVMOONEY,
  votingPower,
  isUnlockedLoading,
  isLockedLoading,
  isVMOONEYLoading,
  isVotingPowerLoading,
}: WalletInfoCardProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { fundWallet } = useFundWallet()
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy address')
    }
  }

  const totalMooney = (unlockedMooney || 0) + (lockedMooney || 0)

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <WalletIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Wallet</h3>
          {address && (
            <button
              onClick={copyAddress}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors group"
            >
              <span className="font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <ClipboardDocumentIcon className="w-3.5 h-3.5 group-hover:text-blue-400" />
            </button>
          )}
        </div>
      </div>

      {/* Balances */}
      <div className="space-y-3 mb-4">
        {/* MOONEY Balance */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Image
                src="/coins/MOONEY.png"
                alt="MOONEY"
                width={20}
                height={20}
                className="rounded-full"
              />
              <span className="text-sm text-gray-400">Available</span>
            </div>
            {isUnlockedLoading ? (
              <LoadingSpinner width="w-4" height="h-4" />
            ) : (
              <span className="text-white font-bold">
                {formatToken(unlockedMooney)}
              </span>
            )}
          </div>
        </div>

        {/* Locked MOONEY */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Image
                src="/assets/vmooney-shield.svg"
                alt="vMOONEY"
                width={20}
                height={20}
              />
              <span className="text-sm text-gray-400">Locked</span>
            </div>
            {isLockedLoading ? (
              <LoadingSpinner width="w-4" height="h-4" />
            ) : (
              <span className="text-white font-bold">
                {formatToken(lockedMooney)}
              </span>
            )}
          </div>
        </div>

        {/* Total Balance */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-3 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-300 font-medium">Total</span>
            {isUnlockedLoading || isLockedLoading ? (
              <LoadingSpinner width="w-4" height="h-4" />
            ) : (
              <span className="text-white font-bold text-lg">
                {formatToken(totalMooney)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => fundWallet && fundWallet(address as `0x${string}`)}
          className="flex items-center justify-center gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
        >
          <ArrowDownIcon className="w-4 h-4" />
          Fund
        </button>
        <StandardButton
          link="/mooney"
          className="flex items-center justify-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
        >
          <ArrowUpIcon className="w-4 h-4" />
          Send
        </StandardButton>
      </div>

      {/* Quick Links */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex gap-2 text-xs">
          <StandardButton
            link="/lock"
            className="flex-1 text-center text-purple-300 hover:text-purple-200 transition-colors py-2"
          >
            Lock Tokens
          </StandardButton>
          <StandardButton
            link="/mooney"
            className="flex-1 text-center text-blue-300 hover:text-blue-200 transition-colors py-2"
          >
            Get MOONEY
          </StandardButton>
        </div>
      </div>
    </div>
  )
}
