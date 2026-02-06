import {
  WalletIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useFundWallet } from '@privy-io/react-auth'
import Image from 'next/image'
import { useState, useContext } from 'react'
import { toast } from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { useENS } from '@/lib/utils/hooks/useENS'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { getChainSlug } from '@/lib/thirdweb/chain'
import {
  arbitrum,
  ethereum,
  base,
  polygon,
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
} from '@/lib/rpc/chains'

type WalletInfoCardProps = {
  unlockedMooney?: number | null
  lockedMooney?: number | null
  votingPower?: number | null
  totalVMOONEY?: number | null
  isUnlockedLoading?: boolean
  isLockedLoading?: boolean
  isVotingPowerLoading?: boolean
  isVMOONEYLoading?: boolean
  onSendClick?: () => void
  setSendModalEnabled?: (enabled: boolean) => void
}

function formatToken(
  value: number | string | null | undefined,
  maxDecimals = 2
): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (num === null || num === undefined || Number.isNaN(num)) return '0'
  if (num === 0) return '0'

  // Dynamic threshold based on maxDecimals (e.g., maxDecimals=2 → 0.01, maxDecimals=4 → 0.0001)
  const threshold = Math.pow(10, -maxDecimals)
  if (num < threshold) return `<${threshold}`

  // Use toLocaleString for comma formatting
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

function formatVotingPower(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  if (value === 0) return '0'
  if (value < 0.01) return '<0.01'
  
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export default function WalletInfoCard({
  unlockedMooney,
  lockedMooney,
  votingPower,
  totalVMOONEY,
  isUnlockedLoading,
  isLockedLoading,
  isVotingPowerLoading,
  isVMOONEYLoading,
  onSendClick,
  setSendModalEnabled,
}: WalletInfoCardProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { data: ensData } = useENS(address)
  const ens = ensData?.name
  const { fundWallet } = useFundWallet()
  const [copied, setCopied] = useState(false)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { nativeBalance, walletChain } = useNativeBalance()
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false)

  // Use the wallet's actual chain for native token display, fall back to selectedChain
  const nativeTokenChain = walletChain || selectedChain
  const nativeTokenSlug = getChainSlug(nativeTokenChain)
  const nativeTokenSymbol = nativeTokenChain?.nativeCurrency?.symbol || 'ETH'

  const availableChains = [
    arbitrum,
    ethereum,
    base,
    polygon,
    sepolia,
    arbitrumSepolia,
    optimismSepolia,
  ]

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
                {ens || `${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
              <ClipboardDocumentIcon className="w-3.5 h-3.5 group-hover:text-blue-400" />
            </button>
          )}
        </div>
      </div>

      {/* Network Selection */}
      <div className="network-dropdown-container relative mb-4">
        <div
          className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group"
          onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5 p-0.5 flex items-center justify-center">
                <Image
                  src={`/icons/networks/${chainSlug}.svg`}
                  width={20}
                  height={20}
                  alt="Network Icon"
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Network</p>
                <span className="text-white text-sm font-medium">
                  {selectedChain.name}
                </span>
              </div>
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 text-gray-400 transition-all duration-200 ${
                networkDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Network Dropdown */}
        {networkDropdownOpen && (
          <div className="absolute top-full mt-2 w-full bg-gradient-to-br from-gray-900 via-blue-900/50 to-purple-900/30 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl z-[9999] max-h-48 overflow-y-auto">
            {availableChains.map((chain) => (
              <button
                key={chain.id}
                type="button"
                className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 transition-colors duration-200 text-left first:rounded-t-lg last:rounded-b-lg"
                onClick={() => {
                  setSelectedChain(chain)
                  setNetworkDropdownOpen(false)
                }}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <Image
                    src={`/icons/networks/${getChainSlug(chain)}.svg`}
                    width={20}
                    height={20}
                    alt={chain.name || 'Chain'}
                    className="object-contain"
                  />
                </div>
                <span className="font-medium text-white flex-1 text-sm">
                  {chain.name || 'Unknown Network'}
                </span>
                {chain.id === selectedChain.id && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Balances */}
      <div className="space-y-3 mb-4">
        {/* Native Token Balance */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src={`/icons/networks/${
                  nativeTokenSlug === 'polygon' ? 'polygon' : 'ethereum'
                }.svg`}
                alt={nativeTokenSymbol}
                width={20}
                height={20}
                className="rounded-full"
              />
              <span className="text-sm text-gray-400">
                {nativeTokenSymbol}
              </span>
            </div>
            <span className="text-white font-semibold">
              {formatToken(nativeBalance, 4)}
            </span>
          </div>
        </div>

        {/* MOONEY Balance */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between">
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
              <span className="text-white font-semibold">
                {formatToken(unlockedMooney)}
              </span>
            )}
          </div>
        </div>

        {/* Locked MOONEY */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/assets/vmooney-shield.svg"
                alt="Locked"
                width={20}
                height={20}
              />
              <span className="text-sm text-gray-400">Locked</span>
            </div>
            {isLockedLoading ? (
              <LoadingSpinner width="w-4" height="h-4" />
            ) : (
              <span className="text-white font-semibold">
                {formatToken(lockedMooney)}
              </span>
            )}
          </div>
        </div>

        {/* Total Balance */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-3 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-300 font-medium">
              Total MOONEY
            </span>
            {isUnlockedLoading || isLockedLoading ? (
              <LoadingSpinner width="w-4" height="h-4" />
            ) : (
              <span className="text-white font-bold">
                {formatToken(totalMooney)}
              </span>
            )}
          </div>
        </div>

        {/* Voting Power */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg p-3 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
              <span className="text-sm text-yellow-300 font-medium">
                Voting Power
              </span>
            </div>
            {isVotingPowerLoading ? (
              <LoadingSpinner width="w-4" height="h-4" />
            ) : (
              <span className="text-white font-bold">
                {formatVotingPower(votingPower)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => fundWallet && fundWallet(address as `0x${string}`)}
          className="flex items-center justify-center gap-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 py-2 px-3 rounded-lg text-xs font-medium transition-all"
        >
          <ArrowDownIcon className="w-3.5 h-3.5" />
          Fund
        </button>
        <button
          onClick={() => setSendModalEnabled ? setSendModalEnabled(true) : onSendClick?.()}
          className="flex items-center justify-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 py-2 px-3 rounded-lg text-xs font-medium transition-all"
        >
          <ArrowUpIcon className="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  )
}
