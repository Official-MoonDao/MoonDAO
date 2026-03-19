import { MOONDAO_HAT_TREE_IDS } from 'const/config'
import { useEffect, useState } from 'react'
import { getChainSlug } from '../thirdweb/chain'
import { hatTreeMatches } from './hatTreeMatches'
import {
  buildRoleHatToEntityIndex,
  resolveEntityIdFromWornHat,
} from './resolveEntityIdFromHat'

function normalizeWearerAddresses(
  input: string | string[] | null | undefined
): string[] {
  if (input == null || input === '') return []
  if (Array.isArray(input)) {
    const s = new Set<string>()
    for (const a of input) {
      if (a && typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(a.trim())) {
        s.add(a.trim().toLowerCase())
      }
    }
    return Array.from(s)
  }
  const t = input.trim()
  if (!/^0x[a-fA-F0-9]{40}$/i.test(t)) return []
  return [t.toLowerCase()]
}

const WEARER_PROPS = encodeURIComponent(
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

async function loadTeamsForWearer(
  teamContract: any,
  selectedChain: any,
  wearerAddress: string,
  roleHatIndex: Map<string, string>
): Promise<Array<{ teamId: string; hats: any[] }>> {
  const res = await fetch(
    `/api/hats/get-wearer?chainId=${selectedChain.id}&wearerAddress=${wearerAddress}&props=${WEARER_PROPS}`
  )

  if (!res.ok) {
    return []
  }

  const hats: any = await res.json()
  if (!hats.currentHats) {
    return []
  }

  const expectedTree = MOONDAO_HAT_TREE_IDS[getChainSlug(selectedChain)]
  const moondaoHats = hats.currentHats.filter((hat: any) =>
    hat.tree?.id && expectedTree ? hatTreeMatches(hat.tree.id, expectedTree) : false
  )

  const moondaoHatsWithTeamId = await Promise.all(
    moondaoHats.map(async (hat: any) => {
      const teamId = await resolveEntityIdFromWornHat(
        teamContract,
        hat,
        roleHatIndex
      )
      if (teamId == null || teamId === '') {
        return null
      }
      return {
        ...hat,
        teamId,
      }
    })
  ).then((results) => results.filter((result) => result !== null))

  const uniqueTeams = [
    ...new Set(moondaoHatsWithTeamId.map((hat: any) => hat.teamId)),
  ].map((teamId: any) => {
    return {
      teamId: teamId,
      hats: moondaoHatsWithTeamId.filter(
        (hat: any) => +hat.teamId === +teamId
      ),
    }
  })

  return uniqueTeams
}

function mergeTeamLists(
  batches: Array<Array<{ teamId: string; hats: any[] }>>
): Array<{ teamId: string; hats: any[] }> {
  const byTeam = new Map<string, Map<string, any>>()

  for (const batch of batches) {
    for (const { teamId, hats } of batch) {
      if (!byTeam.has(teamId)) {
        byTeam.set(teamId, new Map())
      }
      const hatMap = byTeam.get(teamId)!
      for (const h of hats) {
        if (h?.id && !hatMap.has(h.id)) {
          hatMap.set(h.id, h)
        }
      }
    }
  }

  return Array.from(byTeam.entries()).map(([teamId, hatMap]) => ({
    teamId,
    hats: Array.from(hatMap.values()),
  }))
}

/**
 * @param wearerAddressOrAddresses Active wallet and/or linked wallets that may hold hats
 */
export function useTeamWearer(
  teamContract: any,
  selectedChain: any,
  wearerAddressOrAddresses: string | string[] | null | undefined
) {
  const [wornMoondaoHats, setWornMoondaoHats] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  const addresses = normalizeWearerAddresses(wearerAddressOrAddresses)
  const addressKey = addresses.slice().sort().join(',')

  useEffect(() => {
    async function getWearerTeamHats() {
      try {
        setIsLoading(true)
        setWornMoondaoHats(undefined)
        if (addresses.length === 0) {
          setWornMoondaoHats([])
          setIsLoading(false)
          return
        }

        const roleHatIndex = await buildRoleHatToEntityIndex(teamContract)
        const batches = await Promise.all(
          addresses.map((addr) =>
            loadTeamsForWearer(
              teamContract,
              selectedChain,
              addr,
              roleHatIndex
            )
          )
        )

        setWornMoondaoHats(mergeTeamLists(batches))
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
      if (addresses.length > 0) {
        setWornMoondaoHats(undefined)
        setIsLoading(true)
      } else {
        setWornMoondaoHats([])
        setIsLoading(false)
      }
    }
  }, [teamContract, selectedChain, addressKey])

  return { userTeams: wornMoondaoHats, isLoading }
}
