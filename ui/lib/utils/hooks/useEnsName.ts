import { Ethereum } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { initSDK } from '../../thirdweb/thirdweb'

export function useEnsName(address: string | undefined) {
  const [ensName, setEnsName] = useState<string>()

  useEffect(() => {
    if (address) {
      const sdk = initSDK(Ethereum)
      ;(async () => {
        try {
          const ens = await sdk.getProvider().lookupAddress(address)
          console.log(ens)
        } catch (err) {
          console.log(err)
        }
      })()
    }
  }, [address])
  return ensName
}
