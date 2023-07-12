import { Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useAddress, useChain, useSwitchChain } from '@thirdweb-dev/react'
import { useContext, useState } from 'react'
import ChainContext from '../chain-context'

export function useL2Toggle() {
  const address = useAddress()
  const [isL2, setIsL2] = useState<boolean>(false)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const userChain = useChain()
  const switchUserChain = useSwitchChain()

  function toggleLayer() {
    let newNetwork
    if (!isL2) {
      newNetwork = selectedChain === Ethereum ? Polygon : Mumbai
      setSelectedChain(newNetwork)
      address &&
        userChain?.chainId !== newNetwork.chainId &&
        switchUserChain(newNetwork.chainId)
    } else {
      newNetwork = selectedChain === Polygon ? Ethereum : Goerli
      setSelectedChain(newNetwork)
      address &&
        userChain?.chainId !== newNetwork.chainId &&
        switchUserChain(newNetwork.chainId)
    }
    setIsL2(!isL2)
  }

  return { isL2, toggleLayer }
}
