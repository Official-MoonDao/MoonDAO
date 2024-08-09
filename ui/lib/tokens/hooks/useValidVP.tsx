// check if address has a valid lock on L1 or L2
import { Ethereum, Polygon } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { VMOONEY_ADDRESSES } from '../../../const/config'
import { initSDK } from '../../thirdweb/thirdweb'

export function useValidVP(address: string | undefined) {
  const [validLock, setValidLock] = useState<boolean>(false)
  const [totalLocked, setTotalLocked] = useState(0)

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

      const L1LockedMooney = L1Lock[0]
      const L2LockedMooney = L2Lock[0]

      if (L1LockedMooney > 0 || L2LockedMooney > 0) {
        setValidLock(true)
      } else {
        setValidLock(false)
      }

      let totalMooneyLocked
      if (L1LockedMooney && L2LockedMooney) {
        totalMooneyLocked = L1LockedMooney.add(L2LockedMooney)
      } else if (L1LockedMooney) {
        totalMooneyLocked = L1LockedMooney
      } else if (L2LockedMooney) {
        totalMooneyLocked = L2LockedMooney
      } else {
        totalMooneyLocked = 0
      }

      setTotalLocked(totalMooneyLocked.toString() / 10 ** 18)
    }

    if (address) {
      checkForLock()
    }
  }, [address])

  return { validLock, totalLocked }
}
