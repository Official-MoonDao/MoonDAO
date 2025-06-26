import {
  ChartBarSquareIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useState } from 'react'

function AnalyticsChain({ chain, selectChain }: any) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 bg-black/40 hover:bg-black/60 p-3 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200"
      onClick={() => selectChain(chain)}
    >
      {chain === 'all' ? (
        <ChartBarSquareIcon className="w-5 h-5 text-white" />
      ) : (
        <Image
          src={`/icons/networks/${chain}.svg`}
          width={20}
          height={20}
          alt={chain}
        />
      )}
      <span className="text-white text-sm font-medium">
        {chain.charAt(0).toUpperCase() + chain.slice(1)}
      </span>
    </button>
  )
}

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
    <div id="network-selector" className="w-auto flex flex-col relative">
      <div
        id="network-selector-dropdown-button"
        className="flex items-center gap-2 p-3 bg-black/20 hover:bg-black/40 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer transition-all duration-200 group"
        onClick={(e) => {
          if (e.detail === 0) return e.preventDefault()
          setDropdown((prev) => !prev)
        }}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          {analyticsChain === 'all' ? (
            <ChartBarSquareIcon className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-200" />
          ) : (
            <Image
              src={`/icons/networks/${analyticsChain}.svg`}
              width={20}
              height={20}
              alt={analyticsChain}
              className="group-hover:scale-110 transition-transform duration-200"
            />
          )}
        </div>
        <span className="text-white font-medium group-hover:text-blue-300 transition-colors">
          {analyticsChain.charAt(0).toUpperCase() + analyticsChain.slice(1)}
        </span>
        <ChevronDownIcon 
          className={`w-4 h-4 text-gray-400 group-hover:text-white transition-all duration-200 ${dropdown ? 'rotate-180' : ''}`}
        />
      </div>
      {dropdown && (
        <div
          id="network-selector-dropdown"
          className="w-[250px] absolute top-full mt-2 right-0 flex flex-col items-start gap-2 bg-gradient-to-br from-gray-900/95 via-blue-900/80 to-purple-900/70 backdrop-blur-xl border border-white/20 rounded-xl p-3 shadow-2xl z-50 animate-fadeIn"
        >
          <AnalyticsChain chain="all" selectChain={selectChain} />
          <AnalyticsChain chain="ethereum" selectChain={selectChain} />
          <AnalyticsChain chain="polygon" selectChain={selectChain} />
          <AnalyticsChain chain="arbitrum" selectChain={selectChain} />
          <AnalyticsChain chain="base" selectChain={selectChain} />
        </div>
      )}
    </div>
  )
}
