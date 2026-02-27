import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { PROJECT_HAT_TREE_IDS } from 'const/config'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { getChainSlug } from '../thirdweb/chain'

export function useProjectWearer(
  projectContract: any,
  selectedChain: any,
  address: any
) {
  const [wornProjectHats, setWornProjectHats] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function getWearerProjectHats() {
      try {
        setIsLoading(true)
        setWornProjectHats(undefined)
        if (!address) {
          setWornProjectHats([])
          setIsLoading(false)
          return
        }
        const propsParam = encodeURIComponent(
          JSON.stringify({
            currentHats: {
              props: {
                tree: {},
                admin: {
                  admin: {
                    admin: {},
                  },
                },
              },
            },
          })
        )
        const res = await fetch(
          `/api/hats/get-wearer?chainId=${selectedChain.id}&wearerAddress=${address}&props=${propsParam}`
        )

        const hats: any = await res.json()

        if (hats.currentHats) {
          const projectHats = hats.currentHats.filter(
            (hat: any) =>
              hat.tree.id === PROJECT_HAT_TREE_IDS[getChainSlug(selectedChain)]
          )

          const projectHatsWithId = await Promise.all(
            projectHats.map(async (hat: any) => {
              const projectIdFromHat = await readContract({
                contract: projectContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.id],
              })
              const projectIdFromAdmin = await readContract({
                contract: projectContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.admin.id],
              })
              const projectIdFromAdminAdmin = await readContract({
                contract: projectContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.admin.admin.id],
              })

              let projectId
              if (+projectIdFromHat.toString() !== 0) {
                projectId = projectIdFromHat
              } else if (+projectIdFromAdmin.toString() !== 0) {
                projectId = projectIdFromAdmin
              } else if (+projectIdFromAdminAdmin.toString() !== 0) {
                projectId = projectIdFromAdminAdmin
              } else {
                projectId = 0
              }

              const adminHatId = await readContract({
                contract: projectContract,
                method: 'teamAdminHat' as string,
                params: [projectId],
              })
              const prettyAdminHatId = hatIdDecimalToHex(
                BigInt(adminHatId.toString())
              )

              if (
                hat.id === prettyAdminHatId ||
                hat.admin.id === prettyAdminHatId ||
                hat.admin.admin.id === prettyAdminHatId ||
                hat.admin.admin.admin.id === prettyAdminHatId
              ) {
                return {
                  ...hat,
                  projectId: projectId.toString(),
                }
              }
              return null
            })
          ).then((results) => results.filter((result) => result !== null))

          const uniqueProjects = [
            ...new Set(
              projectHatsWithId.map((hat: any) => hat.projectId)
            ),
          ].map((projectId: any) => {
            return {
              projectId: projectId,
              hats: projectHatsWithId.filter(
                (hat: any) => +hat.projectId === +projectId
              ),
            }
          })

          setWornProjectHats(uniqueProjects)
        } else {
          setWornProjectHats([])
        }
        setIsLoading(false)
      } catch (err) {
        console.log(err)
        setWornProjectHats([])
        setIsLoading(false)
      }
    }

    if (projectContract && selectedChain) {
      getWearerProjectHats()
    } else {
      setIsLoading(false)
    }
  }, [projectContract, selectedChain, address])

  return { userProjects: wornProjectHats, isLoading }
}
