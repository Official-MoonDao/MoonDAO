import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { Chain } from '@thirdweb-dev/chains'
import { MOONDAO_HAT_TREE_IDS } from 'const/config'
import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useTeamWearer(
  teamContract: any,
  selectedChain: any,
  address: any
) {
  const [wornMoondaoHats, setWornMoondaoHats] = useState<any>([])

  useEffect(() => {
    async function getWearerTeamHats() {
      try {
        if (!address) return []
        const res = await fetch('/api/hats/get-wearer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chainId: selectedChain.id ?? selectedChain.chainId,
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
              hat.tree.id === MOONDAO_HAT_TREE_IDS[selectedChain.slug]
          )

          //add the teamId to each hat
          const moondaoHatsWithTeamId = await Promise.all(
            moondaoHats.map(async (hat: any) => {
              const teamIdFromHat = await teamContract.call(
                'adminHatToTokenId',
                [hat.id]
              )

              const teamIdFromAdmin = await teamContract.call(
                'adminHatToTokenId',
                [hat.admin.id]
              )

              const teamIdFromAdminAdmin = await teamContract.call(
                'adminHatToTokenId',
                [hat.admin.admin.id]
              )

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

              const adminHatId = await teamContract.call('teamAdminHat', [
                teamId,
              ])
              const prettyAdminHatId = hatIdDecimalToHex(adminHatId)

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
              } else {
                return hat
              }
            })
          )

          setWornMoondaoHats(moondaoHatsWithTeamId)
        }
      } catch (err) {
        console.log(err)
      }
    }

    if (teamContract) getWearerTeamHats()
  }, [selectedChain, address, teamContract])

  return wornMoondaoHats
}
