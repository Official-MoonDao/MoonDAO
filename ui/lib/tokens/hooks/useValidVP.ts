// check if address has a valid lock on L1 or L2
import { Ethereum, Polygon } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { VMOONEY_ADDRESSES } from '../../../const/config'
import { initSDK } from '../../thirdweb/thirdweb'

export function useValidVP(address: string | undefined) {
  const [validLock, setValidLock] = useState<boolean>(false)

  async function checkForLock() {
    const L1sdk = initSDK(Ethereum)
    const L2sdk = initSDK(Polygon)

    const L1MooneyContract = await L1sdk.getContract(
      VMOONEY_ADDRESSES['ethereum']
    )
    const L2MooneyContract = await L2sdk.getContract(
      VMOONEY_ADDRESSES['polygon']
    )

    const L1Lock = await L1MooneyContract.call('locked', [address])
    const L2Lock = await L2MooneyContract.call('locked', [address])

    if (L1Lock[0] > 0 || L2Lock[0] > 0) {
      setValidLock(true)
    } else {
      setValidLock(false)
    }
  }

  useEffect(() => {
    if (address) {
      checkForLock()
    }
  }, [address])

  return validLock
}
