import { Ethereum } from '@thirdweb-dev/chains'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function SwapPage() {
  const { selectedChain, setSelectedChain } = useContext<any>(ChainContext)

  return (
    <div>
      <NetworkSelector />
      <NativeToMooney selectedChain={selectedChain} />
    </div>
  )
}
