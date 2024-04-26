import { useContract } from '@thirdweb-dev/react'
import { MOONEY_ADDRESSES } from 'const/config'
import { useContext, useEffect } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'
import SwapTokens from '@/components/uniswap/SwapTokens'

export default function GetMooney() {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  return (
    <div className="animate-fadeIn">
      <NetworkSelector />

      <h1>Swap</h1>
      <NativeToMooney selectedChain={selectedChain} />
    </div>
  )
}
