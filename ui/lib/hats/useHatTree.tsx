import { Chain } from '@thirdweb-dev/chains'
import { BigNumber } from 'ethers'
import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useHatTree(selectedChain: Chain, treeId: any, topHatId: any) {
  const [hats, setHats] = useState<any>()

  async function getHatTree() {
    try {
      if (!treeId) return []
      const tree = await hatsSubgraphClient.getTree({
        chainId: selectedChain.chainId,
        treeId,
        props: {
          hats: {
            props: {
              wearers: {
                props: {},
              },
            },
          },
        },
      })
      if (tree.hats) {
        const filteredHats = tree.hats.filter(
          (hat: any) => !BigNumber.from(hat.id).eq(BigNumber.from(topHatId))
        )
        setHats(filteredHats)
      } else {
        throw new Error('No hats found')
      }
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    getHatTree()
  }, [selectedChain, treeId])

  return hats
}
