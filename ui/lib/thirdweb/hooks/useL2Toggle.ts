import { Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useContext, useState } from 'react'
import ChainContext from '../chain-context'

export function useL2Toggle() {
  const [isL2, setIsL2] = useState<boolean>(false)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  function toggleLayer() {
    let newNetwork
    if (!isL2) {
      newNetwork = selectedChain === Ethereum ? Polygon : Mumbai
      setSelectedChain(newNetwork)
    } else {
      newNetwork = selectedChain === Polygon ? Ethereum : Goerli
      setSelectedChain(newNetwork)
    }
    setIsL2(!isL2)
  }

  return {
    isL2,
    toggleLayer,
  }
}
