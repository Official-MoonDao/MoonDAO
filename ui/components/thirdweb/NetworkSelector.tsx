import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import Image from 'next/image'
import { useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  arbitrum,
  base,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  ethereum,
  polygon,
  sepolia,
} from '@/lib/rpc/chains'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

type NetworkOptionProps = {
  chain: any
  selectChain: (chain: any) => void
  recommended?: boolean
}

function NetworkOption({
  chain,
  selectChain,
  recommended,
}: NetworkOptionProps) {
  const name = chain.name.replace('Testnet', '').replace('Mainnet', '')
  return (
    <button
      className="w-full flex items-center gap-3 bg-black/20 hover:bg-black/30 p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-200"
      onClick={() => selectChain(chain)}
    >
      <Image
        src={`/icons/networks/${getChainSlug(chain)}.svg`}
        width={16}
        height={16}
        alt={chain.name}
        className="w-4 h-4"
        onError={(e) => {
          console.log(
            `NetworkSelector: Failed to load icon for chain: ${
              chain.name
            }, slug: ${getChainSlug(chain)}`
          )
          const target = e.target as HTMLImageElement
          const parent = target.parentElement
          if (parent) {
            target.style.display = 'none'
            const fallback = document.createElement('div')
            fallback.className =
              'w-4 h-4 bg-white/10 rounded-full flex items-center justify-center text-white text-xs font-bold'
            fallback.textContent = chain.name?.charAt(0) || '?'
            parent.insertBefore(fallback, target)
          }
        }}
      />
      <span className="text-white text-sm font-medium text-left flex flex-col">
        {name}
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
          {chain === arbitrum ? '(Recommended)' : ''}
        </span>
      </span>
    </button>
  )
}

type NetworkSelectorProps = {
  iconsOnly?: boolean
  compact?: boolean
  chains?: any[]
  align?: string
  /**
   * Closed trigger shows this chain (icon + name) instead of global `selectedChain`.
   * Context is still updated when the user picks a network from the dropdown.
   */
  displayChain?: any | null
  /** Called after the user picks a network from the dropdown (not for programmatic context updates). */
  onUserSelectChain?: (chain: any) => void
}

export default function NetworkSelector({
  iconsOnly,
  compact = false,
  chains,
  align = 'right',
  displayChain = null,
  onUserSelectChain,
}: NetworkSelectorProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const shownChain = displayChain ?? selectedChain
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [dropdown, setDropdown] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  async function selectChain(chain: any) {
    setSelectedChain(chain)
    onUserSelectChain?.(chain)
    setDropdown(false)

    // Switch the wallet to the selected network when connected
    const wallet = wallets?.[selectedWallet]
    if (wallet && typeof wallet.switchChain === 'function') {
      try {
        await wallet.switchChain(chain.id)
      } catch (err: any) {
        // Fallback: try addNetworkToWallet for external wallets that may need the chain added first
        if (err?.code === 4902 || err?.message?.includes('Unrecognized chain')) {
          const success = await addNetworkToWallet(chain)
          if (success) {
            await wallet.switchChain(chain.id)
          }
        } else if (err?.code !== 4001) {
          toast.error('Network switch failed. Try again or switch manually.')
        }
      }
    }
  }

  function handleClickOutside({ target }: any) {
    if (
      target.closest('#network-selector') ||
      target.closest('#network-selector-dropdown')
    )
      return
    setDropdown(false)
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const dropdownContent = dropdown && (
    <div
      id="network-selector-dropdown"
      className={`absolute top-full mt-2 flex flex-col gap-2 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl z-[9999] animate-fadeIn min-w-[250px] md:w-auto max-w-[calc(100vw-2rem)] ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      <div className="px-1 pb-2 border-b border-white/10 mb-1">
        <span className="text-white/80 text-xs font-medium uppercase tracking-wide">
          Choose Your Network
        </span>
      </div>
      {chains && chains.length > 0 ? (
        chains.map((chain) => (
          <NetworkOption
            key={chain.id}
            chain={chain}
            selectChain={selectChain}
          />
        ))
      ) : (
        <>
          <NetworkOption chain={arbitrum} selectChain={selectChain} />
          <NetworkOption chain={ethereum} selectChain={selectChain} />
          <NetworkOption chain={base} selectChain={selectChain} />
          <NetworkOption chain={polygon} selectChain={selectChain} />
          {process.env.NEXT_PUBLIC_CHAIN === 'testnet' && (
            <>
              <NetworkOption chain={sepolia} selectChain={selectChain} />
              <NetworkOption chain={baseSepolia} selectChain={selectChain} />
              <NetworkOption
                chain={arbitrumSepolia}
                selectChain={selectChain}
              />
              <NetworkOption
                chain={optimismSepolia}
                selectChain={selectChain}
              />
            </>
          )}
        </>
      )}
    </div>
  )

  return (
    <div
      id="network-selector"
      className={`${!compact && 'w-full sm:w-[250px]'} flex flex-col relative`}
    >
      <div
        ref={triggerRef}
        id="network-selector-dropdown-button"
        className="flex items-center gap-3 p-3 bg-black/20 rounded-2xl border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer"
        onClick={() => {
          setDropdown((prev) => !prev)
        }}
      >
        <Image
          className="h-6 w-6"
          src={`/icons/networks/${getChainSlug(shownChain)}.svg`}
          width={24}
          height={24}
          alt={shownChain.name || ''}
        />
        {!iconsOnly && (
          <span className="text-white text-sm font-medium flex-1">
            {shownChain.name}
          </span>
        )}
        {!iconsOnly && (
          <button
            className={`transition-transform duration-200 ${
              dropdown && 'rotate-180'
            }`}
          >
            <ChevronDownIcon height={16} width={16} className="text-white" />
          </button>
        )}
      </div>
      {dropdownContent}
    </div>
  )
}
