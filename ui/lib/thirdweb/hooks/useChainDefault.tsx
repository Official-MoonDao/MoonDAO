import { Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useContext, useEffect, useMemo } from 'react'
import ChainContext from '../chain-context'

export function useChainDefault(l1OrL2: string) {
  const { setSelectedChain } = useContext(ChainContext)

  const chain = useMemo(() => {
    if (l1OrL2 === 'l1') {
      return process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Ethereum : Goerli
    } else {
      return process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
    }
  }, [l1OrL2])

  useEffect(() => {
    setSelectedChain
  }, [])
}
