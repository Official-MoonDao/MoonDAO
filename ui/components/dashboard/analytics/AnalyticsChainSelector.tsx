import {
  ChartBarSquareIcon,
  ChevronDownIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function AnalyticsChainSelector({
  analyticsChain,
  setAnalyticsChain,
}: any) {
  const [dropdown, setDropdown] = useState(false)

  function selectChain(chain: string) {
    setAnalyticsChain(chain)
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
    <div id="network-selector" className="w-auto flex flex-col">
      <div
        id="network-selector-dropdown-button"
        className="flex items-center gap-2 p-2 bg-darkest-cool rounded-lg"
        onClick={(e) => {
          if (e.detail === 0) return e.preventDefault()
          setDropdown((prev) => !prev)
        }}
      >
        {analyticsChain === 'all' ? (
          <ChartBarSquareIcon height={24} width={24} />
        ) : (
          <Image
            className="h-6 w-6"
            src={`/icons/networks/${analyticsChain}.svg`}
            width={24}
            height={24}
            alt={analyticsChain}
          />
        )}
        <span>
          {analyticsChain.charAt(0).toUpperCase() + analyticsChain.slice(1)}
        </span>
        <button className={`${dropdown && 'rotate-180'}`}>
          <ChevronDownIcon height={14} width={14} />
        </button>
      </div>
      <div className="relative right-[125px]">
        {dropdown && (
          <div
            id="network-selector-dropdown"
            className="w-[250px] absolute flex flex-col items-start gap-2 text-black z-10"
          >
            <button
              type="button"
              className="w-full flex gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
              onClick={() => selectChain('all')}
            >
              {'All'}
            </button>
            <button
              type="button"
              className="w-full flex gap-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-md"
              onClick={() => selectChain('ethereum')}
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
              onClick={() => selectChain('polygon')}
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
              onClick={() => selectChain('arbitrum')}
            >
              <Image
                src="/icons/networks/arbitrum.svg"
                width={24}
                height={24}
                alt="Arbitrumm"
              />
              {'Arbitrum'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
