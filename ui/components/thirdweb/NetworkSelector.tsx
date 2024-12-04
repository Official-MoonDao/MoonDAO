import { ChevronDownIcon } from '@heroicons/react/24/outline'
import {
  Arbitrum,
  ArbitrumSepolia,
  Chain,
  Ethereum,
  Polygon,
  Sepolia,
  Base,
  BaseSepoliaTestnet,
} from '@thirdweb-dev/chains'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../../lib/thirdweb/chain-context'

type NetworkOptionProps = {
  chain: Chain
  selectChain: (chain: Chain) => void
}

function NetworkOption({ chain, selectChain }: NetworkOptionProps) {
  const name = chain.name.replace('Testnet', '').replace('Mainnet', '')
  return (
    <button
      className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
      onClick={() => selectChain(chain)}
    >
      <Image
        src={`/icons/networks/${chain.slug}.svg`}
        width={13}
        height={13}
        alt={chain.name}
      />
      {name}
    </button>
  )
}

type NetworkSelectorProps = {
  iconsOnly?: boolean
}

export default function NetworkSelector({ iconsOnly }: NetworkSelectorProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)
  const [dropdown, setDropdown] = useState(false)

  function selectChain(chain: Chain) {
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
    <div id="network-selector" className="w-[250px] flex flex-col">
      <div
        id="network-selector-dropdown-button"
        className="flex items-center gap-2 p-2 bg-darkest-cool rounded-lg"
        onClick={(e) => {
          if (e.detail === 0) return e.preventDefault()
          setDropdown((prev) => !prev)
        }}
      >
        <Image
          className="h-6 w-6"
          src={`/icons/networks/${selectedChain.slug}.svg`}
          width={24}
          height={24}
          alt={selectedChain.name}
        />
        {!iconsOnly && <span>{selectedChain.name}</span>}
        <button className={`${dropdown && 'rotate-180'}`}>
          <ChevronDownIcon height={14} width={14} />
        </button>
      </div>
      {dropdown && (
        <div
          id="network-selector-dropdown"
          className="w-[250px] absolute flex flex-col items-start gap-2 text-black z-10"
        >
          <NetworkOption chain={Ethereum} selectChain={selectChain} />
          <NetworkOption chain={Arbitrum} selectChain={selectChain} />
          <NetworkOption chain={Base} selectChain={selectChain} />
          <NetworkOption chain={Polygon} selectChain={selectChain} />
          {process.env.NEXT_PUBLIC_ENV === 'dev' && (
            <>
              <NetworkOption chain={Sepolia} selectChain={selectChain} />
              <NetworkOption
                chain={BaseSepoliaTestnet}
                selectChain={selectChain}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
