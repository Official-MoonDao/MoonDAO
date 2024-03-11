import { Chain } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useHatTree(selectedChain: Chain, treeId: number | undefined) {
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
      setHats(tree.hats)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    getHatTree()
  }, [selectedChain, treeId])

  return hats
}
