import { useAddress, useContract } from '@thirdweb-dev/react'
import { useState } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'

export function useMaticBridge(
  amount: number,
  parentTokenAddress: string,
  fxRootTunnelAddress: string,
  fxProxyTunnelAddress: string
) {
  const address = useAddress()
  const [ethTOMatic, setEthToMatic] = useState(true)
  const [bridgeAmount, setBridgeAmount] = useState(0)

  const { contract: parentTokenContract } = useContract(
    parentTokenAddress,
    ERC20
  )
}
