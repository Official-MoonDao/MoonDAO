import { ChevronDownIcon } from '@heroicons/react/24/outline'
import {
  Arbitrum,
  ArbitrumSepolia,
  Chain,
  Ethereum,
  Polygon,
  Sepolia,
} from '@thirdweb-dev/chains'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../../lib/thirdweb/chain-context'

export default function NetworkSelector() {
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
    <div id="network-selector" className="w-[300px] flex flex-col">
      <div
        className="flex items-center gap-2"
        onClick={() => setDropdown((prev) => !prev)}
      >
        <Image
          src={`/icons/networks/${selectedChain.slug}.svg`}
          width={24}
          height={24}
          alt={selectedChain.name}
        />
        <span>{selectedChain.name}</span>
        <button className={`${dropdown && 'rotate-180'}`}>
          <ChevronDownIcon height={14} width={14} />
        </button>
      </div>
      {dropdown && (
        <div className="flex flex-col items-start gap-2 text-black">
          <button
            className="w-full flex gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
            onClick={() => selectChain(Ethereum)}
          >
            <Image
              src="/icons/networks/ethereum.svg"
              width={13}
              height={13}
              alt="Ethereum"
            />
            {'Ethereum'}
          </button>
          <button
            className="w-full flex gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
            onClick={() => selectChain(Polygon)}
          >
            <Image
              src="/icons/networks/polygon.svg"
              width={24}
              height={24}
              alt="Polygon"
            />
            {'Polygon'}
          </button>
          <button
            className="w-full flex gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
            onClick={() => selectChain(Arbitrum)}
          >
            <Image
              src="/icons/networks/arbitrum.svg"
              width={24}
              height={24}
              alt="Arbitrumm"
            />
            {'Arbitrum'}
          </button>
          <button
            className="w-full flex gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
            onClick={() => selectChain(Sepolia)}
          >
            <Image
              src="/icons/networks/ethereum.svg"
              width={13}
              height={13}
              alt="Sepolia"
            />
            {'Sepolia'}
          </button>
        </div>
      )}
    </div>
  )
}
