import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { MOONDAO_HAT_TREE_IDS } from 'const/config'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { getChainSlug } from '../thirdweb/chain'

export function useTeamWearer(
  teamContract: any,
  selectedChain: any,
  address: any
) {
  const [wornMoondaoHats, setWornMoondaoHats] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function getWearerTeamHats() {
      try {
        setIsLoading(true)
        setWornMoondaoHats(undefined)
        if (!address) {
          setWornMoondaoHats([])
          setIsLoading(false)
          return
        }
        const res = await fetch('/api/hats/get-wearer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chainId: selectedChain.id,
            wearerAddress: address,
            props: {
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
            },
          }),
        })

        const hats: any = await res.json()

        //filter worn hats to only include hats that are in the MoonDAO hat tree
        if (hats.currentHats) {
          //filter hats to only include hats that are in the MoonDAO hat tree
          const moondaoHats = hats.currentHats.filter(
            (hat: any) =>
              hat.tree.id === MOONDAO_HAT_TREE_IDS[getChainSlug(selectedChain)]
          )

          //add the teamId to each hat
          const moondaoHatsWithTeamId = await Promise.all(
            moondaoHats.map(async (hat: any) => {
              const teamIdFromHat = await readContract({
                contract: teamContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.id],
              })
              const teamIdFromAdmin = await readContract({
                contract: teamContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.admin.id],
              })
              const teamIdFromAdminAdmin = await readContract({
                contract: teamContract,
                method: 'adminHatToTokenId' as string,
                params: [hat.admin.admin.id],
              })

              let teamId
              if (+teamIdFromHat.toString() !== 0) {
                teamId = teamIdFromHat
              } else if (+teamIdFromAdmin.toString() !== 0) {
                teamId = teamIdFromAdmin
              } else if (+teamIdFromAdminAdmin.toString() !== 0) {
                teamId = teamIdFromAdminAdmin
              } else {
                teamId = 0
              }

              const adminHatId = await readContract({
                contract: teamContract,
                method: 'teamAdminHat' as string,
                params: [teamId],
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
                  teamId: teamId.toString(),
                }
              }
              return null
            })
          ).then((results) => results.filter((result) => result !== null))

          const uniqueTeams = [
            ...new Set(moondaoHatsWithTeamId.map((hat: any) => hat.teamId)),
          ].map((teamId: any) => {
            return {
              teamId: teamId,
              hats: moondaoHatsWithTeamId.filter(
                (hat: any) => hat.teamId === teamId
              ),
            }
          })

          setWornMoondaoHats(uniqueTeams)
        } else {
          setWornMoondaoHats([])
        }
        setIsLoading(false)
      } catch (err) {
        console.log(err)
        setWornMoondaoHats([])
        setIsLoading(false)
      }
    }

    if (teamContract && selectedChain) {
      getWearerTeamHats()
    } else {
      setIsLoading(false)
    }
  }, [teamContract, selectedChain, address])

  return { userTeams: wornMoondaoHats, isLoading }
}
