import { Ethereum } from '@thirdweb-dev/chains'
import { useSDK } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { initSDK } from '../../thirdweb/thirdweb'

export function useENS(address: string = '') {
  const [ens, setENS] = useState<any>()
  const sdk = useSDK()

  async function getENS() {
    if (!sdk || !address) return
    const provider = sdk.getProvider()
    try {
      const ensLookup = await provider.lookupAddress(address)
      setENS(ensLookup)
    } catch (err) {}
  }

  useEffect(() => {
    getENS()
  }, [address, sdk])

  return ens
}
