import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { useContext, useEffect } from 'react'
import { arbitrum, sepolia } from 'thirdweb/chains'
import ChainContext from '../chain-context'
import ChainContextV5 from '../chain-context-v5'

export function useChainDefault() {
  const { setSelectedChain } = useContext(ChainContext)
  const { setSelectedChain: setSelectedChainV5 } = useContext(ChainContextV5)

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
    setSelectedChainV5(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
    )
  }, [setSelectedChain, setSelectedChainV5])
}
