import { POSClient } from '@maticnetwork/maticjs'
import { Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { useMemo, useState } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'
import { initSDK } from '../../thirdweb/thirdweb'

export function useMaticBridge(
  amount: number,
  parentAddress: string,
  childProxyAddress: string
) {
  const address = useAddress()
  const [ethTOMatic, setEthToMatic] = useState(true)
  const [bridgeAmount, setBridgeAmount] = useState(0)

  const { contract: parentTokenContract } = useContract(
    parentAddress,
    ERC20.abi
  )

  const maticPOSClient = useMemo(() => {
    const ethereumChain =
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Ethereum : Goerli
    const maticChain =
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai

    const parentProvider = initSDK(ethereumChain).getProvider()
    const maticProvider = initSDK(maticChain).getProvider()

    return new MaticPOSClient({
      network:
        process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'mainnet' : 'testnet',
      version: 'mumbai',
      parentProvider,
      maticProvider,
    })
  }, [])

  //swap from parent to proxy
  async function depositTokens() {
    try {
      //approve token
      const approvalTx = await maticPOSClient.approveERC20ForDeposit(
        parentAddress,
        amount,
        {
          from: address,
        }
      )

      console.log(approvalTx)

      const depositTx = await maticPOSClient.depositERC20ForUser(
        parentAddress,
        address,
        amount,
        {
          from: address,
        }
      )
    } catch (err: any) {
      console.log(err.message)
    }
  }

  //swap from proxy to parent
  async function burnTokens() {
    try {
      const burnTx = await maticPOSClient.burnERC20(childProxyAddress, amount, {
        from: address,
      })
    } catch (err: any) {}
  }

  return { depositTokens, burnTokens }
}
