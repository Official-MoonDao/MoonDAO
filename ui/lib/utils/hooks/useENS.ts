import { Ethereum } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { initSDK } from '../../thirdweb/thirdweb'

export function useENS(address: string = '') {
  const [ens, setENS] = useState<any>()

  async function getENS() {
    const sdk = initSDK(Ethereum)
    const provider = sdk.getProvider()
    const ensLookup = await provider.lookupAddress(address)
    setENS(ensLookup)
  }

  useEffect(() => {
    if (address) getENS()
  }, [address])

  return ens
}
