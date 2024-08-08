// check if address has a valid lock on L1 or L2
import { Ethereum, Polygon } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { VMOONEY_ADDRESSES } from '../../../const/config'
import { initSDK } from '../../thirdweb/thirdweb'

export function useValidVP(address: string | undefined) {
  const [validLock, setValidLock] = useState<boolean>(false)
  const [totalLocked, setTotalLocked] = useState(0)
  const [L1Lock, setL1Lock] = useState()
  const [L2Lock, setL2Lock] = useState()

  useEffect(() => {
    async function checkForLock() {
      const L1sdk = initSDK(Ethereum)
      const L2sdk = initSDK(Polygon)

      const L1VMooneyContract = await L1sdk.getContract(
        VMOONEY_ADDRESSES['ethereum']
      )
      const L2VMooneyContract = await L2sdk.getContract(
        VMOONEY_ADDRESSES['polygon']
      )

      const L1Lock = await L1VMooneyContract.call('locked', [address])
      const L2Lock = await L2VMooneyContract.call('locked', [address])

      if (L1Lock[0] > 0 || L2Lock[0] > 0) {
        setValidLock(true)
      } else {
        setValidLock(false)
      }

      const totalMooneyLocked = L1Lock[0]
        ? L1Lock[0].add(L2Lock[0])
        : L2Lock[0]
        ? L2Lock[0]
        : 0

      setTotalLocked(totalMooneyLocked.toString() / 10 ** 18)
    }

    if (address) {
      checkForLock()
    }
  }, [address])

  return { validLock, totalLocked }
}
