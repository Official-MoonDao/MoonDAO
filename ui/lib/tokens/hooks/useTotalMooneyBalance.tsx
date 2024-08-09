//Get total mooney balance for an address on L1 and L2
import { Ethereum, Polygon } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'
import { MOONEY_ADDRESSES } from '../../../const/config'
import { initSDK } from '../../thirdweb/thirdweb'

export function useTotalMooneyBalance(address: string | undefined) {
  const [totalMooneyBalance, setTotalMooneyBalance] = useState<number>(0)

  useEffect(() => {
    async function checkForBalance() {
      const L1sdk = initSDK(Ethereum)
      const L2sdk = initSDK(Polygon)

      const L1MooneyContract = await L1sdk.getContract(
        MOONEY_ADDRESSES['ethereum'],
        ERC20.abi
      )
      const L2MooneyContract = await L2sdk.getContract(
        MOONEY_ADDRESSES['polygon'],
        ERC20.abi
      )

      const L1Lock = await L1MooneyContract.call('balanceOf', [address])
      const L2Lock = await L2MooneyContract.call('balanceOf', [address])

      setTotalMooneyBalance(L1Lock?.add(L2Lock).toString() / 10 ** 18)
    }

    if (address) {
      checkForBalance()
    }
  }, [address])

  return totalMooneyBalance
}
