import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useContext, useEffect } from 'react'
import ChainContextV5 from '../chain-context-v5'

export function useChainDefault() {
  const { setSelectedChain: setSelectedChainV5 } = useContext(ChainContextV5)

  useEffect(() => {
    setSelectedChainV5(DEFAULT_CHAIN_V5)
  }, [])
}
