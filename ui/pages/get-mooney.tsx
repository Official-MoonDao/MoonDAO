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
      <h1 className="page-title">Get Mooney</h1>
      <div className="mt-8">
        <NetworkSelector />
        <div className="mt-8">
          <NativeToMooney selectedChain={selectedChain} />
        </div>
      </div>
    </div>
  )
}
