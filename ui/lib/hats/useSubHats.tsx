import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useSubHats(selectedChain: any, hatId: any) {
  const [subHats, setSubHats] = useState<any>()

  async function getSubHats() {
    try {
      const hat = await hatsSubgraphClient.getHat({
        chainId: selectedChain.chainId,
        hatId,
        props: {
          subHats: {
            props: {
              wearers: {
                props: {},
              },
            },
          },
        },
      })
      setSubHats(hat.subHats)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    if (hatId) getSubHats()
  }, [selectedChain, hatId])

  return subHats
}
