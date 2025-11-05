import { BigNumber } from 'ethers'
import { useEffect, useState } from 'react'

export function useHatTree(selectedChain: any, treeId: any, topHatId: any) {
  const [hats, setHats] = useState<any>()

  useEffect(() => {
    async function getHatTree() {
      try {
        if (!treeId) return []
        const propsParam = encodeURIComponent(
          JSON.stringify({
            hats: {
              props: {
                wearers: {
                  props: {},
                },
              },
            },
          })
        )
        const res = await fetch(
          `/api/hats/get-tree?chainId=${selectedChain.id}&treeId=${treeId}&props=${propsParam}`
        )

        const tree = await res.json()

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
    if (selectedChain && treeId) getHatTree()
  }, [selectedChain, treeId, topHatId])

  return hats
}
