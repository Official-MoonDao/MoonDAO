//Get total mooney balance for an address on L1 and L2
import { Arbitrum, Base, Ethereum, Polygon } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'
import { MOONEY_ADDRESSES } from '../../../const/config'
import { initSDK } from '../../thirdweb/thirdweb'

export function useTotalMooneyBalance(address: string | undefined) {
  const [totalMooneyBalance, setTotalMooneyBalance] = useState<number>(0)

  useEffect(() => {
    async function checkForBalance() {
      const ethSDK = initSDK(Ethereum)
      const polygonSDK = initSDK(Polygon)
      const arbSDK = initSDK(Arbitrum)
      const baseSDK = initSDK(Base)

      const ethMooneyContract = await ethSDK.getContract(
        MOONEY_ADDRESSES['ethereum'],
        ERC20.abi
      )
      const polygonMooneyContract = await polygonSDK.getContract(
        MOONEY_ADDRESSES['polygon'],
        ERC20.abi
      )
      const arbMooneyContract = await arbSDK.getContract(
        MOONEY_ADDRESSES['arbitrum'],
        ERC20.abi
      )
      const baseMooneyContract = await baseSDK.getContract(
        MOONEY_ADDRESSES['base'],
        ERC20.abi
      )

      const ethMooney = await ethMooneyContract.call('balanceOf', [address])
      const polygonMooney = await polygonMooneyContract.call('balanceOf', [
        address,
      ])
      const arbMooney = await arbMooneyContract.call('balanceOf', [address])
      const baseMooney = await baseMooneyContract.call('balanceOf', [address])

      setTotalMooneyBalance(
        ethMooney
          ?.add(polygonMooney)
          .add(arbMooney)
          .add(baseMooney)
          .toString() /
          10 ** 18
      )
    }

    if (address) {
      checkForBalance()
    }
  }, [address])

  return totalMooneyBalance
}
