import { Ethereum, Polygon, Sepolia } from '@thirdweb-dev/chains'
import { useContext, useState } from 'react'
import ChainContext from '../chain-context'

export function useL2Toggle() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)
  const [isL2, setIsL2] = useState<boolean>(selectedChain === Polygon)

  function toggleLayer() {
    let newNetwork
    if (!isL2) {
      newNetwork = selectedChain === Ethereum ? Polygon : Sepolia
      setSelectedChain(newNetwork)
    } else {
      newNetwork = selectedChain === Polygon ? Ethereum : Sepolia
      setSelectedChain(newNetwork)
    }
    setIsL2(!isL2)
  }

  return {
    isL2,
    toggleLayer,
  }
}
