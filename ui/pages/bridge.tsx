import { useContext } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'

export default function Bridge() {
  const { setSelectedChain } = useContext(ChainContext)

  return (
    <div className="animate-fadeIn">
      <h1>Bridge</h1>

      <ArbitrumBridge setSelectedChain={setSelectedChain} />
    </div>
  )
}
