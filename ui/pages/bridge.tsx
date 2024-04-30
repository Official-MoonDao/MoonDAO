import { Ethereum, Sepolia } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import { MOONEY_ADDRESSES } from 'const/config'
import { useContext, useEffect } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function Bridge() {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  useEffect(() => {
    setSelectedChain(Ethereum)
  }, [])

  return (
    <div className="animate-fadeIn">
      <h1 className="page-title">Arbitrum Bridge</h1>
      <div className="mt-8">
        <ArbitrumBridge
          selectedChain={selectedChain}
          setSelectedChain={setSelectedChain}
        />
      </div>
    </div>
  )
}
