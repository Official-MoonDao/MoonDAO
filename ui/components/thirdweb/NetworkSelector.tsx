import { ChevronDownIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  arbitrum,
  base,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  ethereum,
  polygon,
  sepolia,
} from '@/lib/infura/infuraChains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

type NetworkOptionProps = {
  chain: any
  selectChain: (chain: any) => void
}

function NetworkOption({ chain, selectChain }: NetworkOptionProps) {
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
      <span className="text-white text-sm font-medium">{name}</span>
    </button>
  )
}

type NetworkSelectorProps = {
  iconsOnly?: boolean
  compact?: boolean
  chains?: any[]
}

export default function NetworkSelector({
  iconsOnly,
  compact = false,
  chains,
}: NetworkSelectorProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const [dropdown, setDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  })
  const triggerRef = useRef<HTMLDivElement>(null)

  function selectChain(chain: any) {
    setSelectedChain(chain)
    setDropdown(false)
  }

  function updateDropdownPosition() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownWidth = 250
      const dropdownHeight = 200 // Approximate height for 4 options
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const padding = 16 // 16px padding from viewport edge

      // Calculate initial left position
      let left = rect.left

      // Check if dropdown would overflow on the right side
      if (left + dropdownWidth > viewportWidth - padding) {
        // Position dropdown to the left of the trigger, aligned with its right edge
        left = rect.right - dropdownWidth
      }

      // Ensure it doesn't go off the left side either
      if (left < padding) {
        left = padding
      }

      // Calculate vertical position
      let top = rect.bottom + 8 // 8px gap (mt-2)

      // Check if dropdown would overflow on the bottom
      if (rect.bottom + dropdownHeight > viewportHeight - padding) {
        // Position dropdown above the trigger
        top = rect.top - dropdownHeight - 8
      }

      // Ensure it doesn't go off the top either
      if (top < padding) {
        top = rect.bottom + 8 // fallback to below
      }

      setDropdownPosition({
        top: top,
        left: left,
        width: dropdownWidth,
      })
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

  useEffect(() => {
    if (dropdown) {
      updateDropdownPosition()
      // Update position on scroll/resize
      const handlePositionUpdate = () => updateDropdownPosition()
      window.addEventListener('scroll', handlePositionUpdate, true)
      window.addEventListener('resize', handlePositionUpdate)

      return () => {
        window.removeEventListener('scroll', handlePositionUpdate, true)
        window.removeEventListener('resize', handlePositionUpdate)
      }
    }
  }, [dropdown, compact])

  const dropdownContent = dropdown && (
    <div
      id="network-selector-dropdown"
      className="fixed flex flex-col gap-2 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl z-[9999] animate-fadeIn max-w-[250px]"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
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
          <NetworkOption chain={ethereum} selectChain={selectChain} />
          <NetworkOption chain={arbitrum} selectChain={selectChain} />
          <NetworkOption chain={base} selectChain={selectChain} />
          <NetworkOption chain={polygon} selectChain={selectChain} />
        </>
      )}
    </div>
  )

  return (
    <div
      id="network-selector"
      className={`${!compact && 'w-[250px]'} flex flex-col relative`}
    >
      <div
        ref={triggerRef}
        id="network-selector-dropdown-button"
        className="flex items-center gap-3 p-3 bg-black/20 rounded-2xl border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer"
        onClick={(e) => {
          if (e.detail === 0) return e.preventDefault()
          setDropdown((prev) => !prev)
        }}
      >
        <Image
          className="h-6 w-6"
          src={`/icons/networks/${getChainSlug(selectedChain)}.svg`}
          width={24}
          height={24}
          alt={selectedChain.name || ''}
        />
        {!iconsOnly && (
          <span className="text-white text-sm font-medium flex-1">
            {selectedChain.name || ''}
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
      {typeof window !== 'undefined' &&
        dropdownContent &&
        createPortal(dropdownContent, document.body)}
    </div>
  )
}
