import { Chain } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useWearer(selectedChain: Chain, address: any) {
  const [hats, setHats] = useState<any>([])

  async function getWearerHats() {
    try {
      if (!address) return []
      const hats = await hatsSubgraphClient.getWearer({
        chainId: selectedChain.chainId,
        wearerAddress: address,
        props: {
          currentHats: {
            props: {},
          },
        },
      })
      setHats(hats?.currentHats)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    getWearerHats()
  }, [selectedChain, address])

  return hats
}
