import { useContract } from '@thirdweb-dev/react'
import { MOONEY_ADDRESSES } from 'const/config'
import { useContext } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function Bridge() {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  return (
    <div className="animate-fadeIn">
      <NetworkSelector />

      <h1>Bridge</h1>
      <ArbitrumBridge setSelectedChain={setSelectedChain} />
    </div>
  )
}
