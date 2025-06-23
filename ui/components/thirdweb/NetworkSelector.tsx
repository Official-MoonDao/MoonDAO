import { ChevronDownIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import {
  arbitrum,
  base,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  ethereum,
  polygon,
  sepolia,
} from 'thirdweb/chains'
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
      className="w-full flex items-center gap-3 bg-black/20 hover:bg-black/40 p-3 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 text-white group"
      onClick={() => selectChain(chain)}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        <Image
          src={`/icons/networks/${getChainSlug(chain)}.svg`}
          width={20}
          height={20}
          alt={chain.name}
          className="group-hover:scale-110 transition-transform duration-200"
        />
      </div>
      <span className="font-medium group-hover:text-blue-300 transition-colors">{name}</span>
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

  function selectChain(chain: any) {
    setSelectedChain(chain)
    setDropdown(false)
  }

  function handleClickOutside({ target }: any) {
    if (target.closest('#network-selector')) return
    setDropdown(false)
  }
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    //
    <div
      id="network-selector"
      className={`${!compact ? 'w-[250px]' : 'w-full'} flex flex-col relative`}
    >
      <div
        id="network-selector-dropdown-button"
        className={`flex items-center ${iconsOnly ? 'justify-center' : 'justify-between'} gap-2 p-2 bg-black/20 hover:bg-black/40 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer transition-all duration-200 group ${compact ? 'w-full h-full' : ''}`}
        onClick={(e) => {
          if (e.detail === 0) return e.preventDefault()
          setDropdown((prev) => !prev)
        }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <Image
            src={`/icons/networks/${getChainSlug(selectedChain)}.svg`}
            width={20}
            height={20}
            alt={selectedChain.name || ''}
            className="group-hover:scale-110 transition-transform duration-200"
          />
        </div>
        {!iconsOnly && <span className="text-white font-medium group-hover:text-blue-300 transition-colors">{selectedChain.name || ''}</span>}
        {!iconsOnly && (
          <ChevronDownIcon 
            className={`w-4 h-4 text-gray-400 group-hover:text-white transition-all duration-200 ${dropdown ? 'rotate-180' : ''}`}
          />
        )}
      </div>
      {dropdown && (
        <div
          id="network-selector-dropdown"
          className={`${
            !compact ? 'w-[250px]' : 'w-[200px]'
          } absolute top-full mt-2 right-0 flex flex-col items-start gap-2 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl z-50 max-h-80 overflow-y-auto scrollbar-hide`}
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
              {process.env.NEXT_PUBLIC_ENV === 'dev' && (
                <>
                  <NetworkOption chain={sepolia} selectChain={selectChain} />
                  <NetworkOption
                    chain={baseSepolia}
                    selectChain={selectChain}
                  />
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
      )}
    </div>
  )
}
