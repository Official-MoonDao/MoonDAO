import {
  Arbitrum,
  Sepolia,
} from '@thirdweb-dev/chains'
import { useContext, useEffect, useMemo } from 'react'
import ChainContext from '../chain-context'

export function useChainDefault() {
  const { setSelectedChain } = useContext(ChainContext)

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [setSelectedChain])
}
