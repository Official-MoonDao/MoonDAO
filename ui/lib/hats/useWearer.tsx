import { Chain } from '@thirdweb-dev/chains'
import { MOONDAO_HAT_TREE_IDS } from 'const/config'
import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useWearer(selectedChain: Chain, address: any) {
  const [wornMoondaoHats, setWornMoondaoHats] = useState<any>([])

  async function getWearerHats() {
    try {
      if (!address) return []
      const hats = await hatsSubgraphClient.getWearer({
        chainId: selectedChain.chainId,
        wearerAddress: address,
        props: {
          currentHats: {
            props: {
              tree: {},
            },
          },
        },
      })

      //filter worn hats to only include hats that are in the MoonDAO hat tree
      if (hats.currentHats) {
        const filteredHats = hats.currentHats.filter(
          (hat: any) => hat.tree.id === MOONDAO_HAT_TREE_IDS[selectedChain.slug]
        )
        setWornMoondaoHats(filteredHats)
      }
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    getWearerHats()
  }, [selectedChain, address])

  return wornMoondaoHats
}
