import { useContext } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

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
