import { MOONDAO_HAT_TREE_IDS } from 'const/config'
import { useEffect, useRef, useState } from 'react'
import { getChainSlug } from '../thirdweb/chain'
import { hatTreeMatches } from './hatTreeMatches'
import { fetchWearerHatsJsonCached } from './fetchWearerHatsCached'
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

async function fetchTeamTreeHatsForAddress(
  selectedChain: any,
  wearerAddress: string
): Promise<any[]> {
  try {
    const hats = await fetchWearerHatsJsonCached(
      selectedChain.id,
      wearerAddress,
      WEARER_PROPS
    )
    if (!hats?.currentHats) {
      return []
    }

    const expectedTree = MOONDAO_HAT_TREE_IDS[getChainSlug(selectedChain)]
    return hats.currentHats.filter((hat: any) =>
      hat.tree?.id && expectedTree ? hatTreeMatches(hat.tree.id, expectedTree) : false
    )
  } catch {
    return []
  }
}

function groupHatsByTeamId(
  moondaoHatsWithTeamId: Array<{ teamId: string; [k: string]: any }>
): Array<{ teamId: string; hats: any[] }> {
  const uniqueTeams = [
    ...new Set(moondaoHatsWithTeamId.map((hat: any) => hat.teamId)),
  ].map((teamId: any) => ({
    teamId,
    hats: moondaoHatsWithTeamId.filter(
      (hat: any) => +hat.teamId === +teamId
    ),
  }))
  return uniqueTeams
}

async function resolveTeamTreeHatsToBatches(
  teamContract: any,
  moondaoHats: any[],
  roleHatIndex: Map<string, string> | undefined
): Promise<Array<{ teamId: string; hats: any[] }>> {
  const moondaoHatsWithTeamId = (
    await Promise.all(
      moondaoHats.map(async (hat: any) => {
        try {
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
        } catch {
          return null
        }
      })
    )
  ).filter((result) => result !== null)

  return groupHatsByTeamId(moondaoHatsWithTeamId as any)
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

  const teamContractRef = useRef(teamContract)
  const selectedChainRef = useRef(selectedChain)
  teamContractRef.current = teamContract
  selectedChainRef.current = selectedChain

  const contractAddress =
    typeof teamContract?.address === 'string'
      ? teamContract.address.toLowerCase()
      : undefined
  const chainId = selectedChain?.id

  useEffect(() => {
    let cancelled = false

    async function getWearerTeamHats() {
      const tc = teamContractRef.current
      const sc = selectedChainRef.current
      try {
        setIsLoading(true)
        setWornMoondaoHats(undefined)
        if (addresses.length === 0) {
          if (!cancelled) {
            setWornMoondaoHats([])
          }
          return
        }

        const hatLists = await Promise.all(
          addresses.map((addr) => fetchTeamTreeHatsForAddress(sc, addr))
        )
        if (cancelled) return

        if (!hatLists.some((list) => list.length > 0)) {
          if (!cancelled) {
            setWornMoondaoHats([])
          }
          return
        }

        const firstPass = await Promise.all(
          hatLists.map((list) =>
            Promise.all(
              list.map((hat) =>
                resolveEntityIdFromWornHat(tc, hat, undefined)
              )
            )
          )
        )
        if (cancelled) return

        const needsFullRoleIndex = firstPass.some((row) =>
          row.some((id) => id == null)
        )

        let batches: Array<Array<{ teamId: string; hats: any[] }>>

        if (!needsFullRoleIndex) {
          batches = hatLists.map((list, i) => {
            const withIds = list
              .map((hat, j) => {
                const teamId = firstPass[i][j]
                if (teamId == null || teamId === '') return null
                return { ...hat, teamId }
              })
              .filter(Boolean) as any[]
            return groupHatsByTeamId(withIds)
          })
        } else {
          let roleHatIndex = await buildRoleHatToEntityIndex(tc)
          if (roleHatIndex.size === 0 && !cancelled) {
            await new Promise((r) => setTimeout(r, 450))
            if (!cancelled) {
              roleHatIndex = await buildRoleHatToEntityIndex(tc)
            }
          }
          if (cancelled) return
          batches = await Promise.all(
            hatLists.map((moondaoHats) =>
              resolveTeamTreeHatsToBatches(tc, moondaoHats, roleHatIndex)
            )
          )
        }

        if (cancelled) return
        setWornMoondaoHats(mergeTeamLists(batches))
      } catch (err) {
        console.log(err)
        if (!cancelled) {
          setWornMoondaoHats((prev) =>
            Array.isArray(prev) && prev.length > 0 ? prev : []
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    if (teamContract && selectedChain) {
      getWearerTeamHats()
    } else {
      if (addresses.length > 0) {
        setWornMoondaoHats(undefined)
        setIsLoading(false)
      } else {
        setWornMoondaoHats([])
        setIsLoading(false)
      }
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see useProjectWearer
  }, [contractAddress, chainId, addressKey])

  return { userTeams: wornMoondaoHats, isLoading }
}
