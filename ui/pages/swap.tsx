import { useContract } from '@thirdweb-dev/react'
import { MOONEY_ADDRESSES } from 'const/config'
import { useContext, useEffect } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import SwapTokens from '@/components/uniswap/SwapTokens'

export default function Swap() {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )

  useEffect(() => {}, [])

  return (
    <div className="animate-fadeIn">
      <NetworkSelector />

      <h1>Swap</h1>
      <SwapTokens
        selectedChain={selectedChain}
        mooneyContract={mooneyContract}
      />
    </div>
  )
}
