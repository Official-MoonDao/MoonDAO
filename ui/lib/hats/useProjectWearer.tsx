import { PROJECT_HAT_TREE_IDS } from 'const/config'
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

/** Hats in the project tree only — cheap (subgraph/API) before any on-chain index scan */
async function fetchProjectTreeHatsForAddress(
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

    const expectedTree = PROJECT_HAT_TREE_IDS[getChainSlug(selectedChain)]
    return hats.currentHats.filter((hat: any) =>
      hat.tree?.id && expectedTree ? hatTreeMatches(hat.tree.id, expectedTree) : false
    )
  } catch {
    return []
  }
}

function groupHatsByProjectId(
  projectHatsWithId: Array<{ projectId: string; [k: string]: any }>
): Array<{ projectId: string; hats: any[] }> {
  return [
    ...new Set(projectHatsWithId.map((hat: any) => hat.projectId)),
  ].map((projectId: any) => ({
    projectId,
    hats: projectHatsWithId.filter(
      (hat: any) => +hat.projectId === +projectId
    ),
  }))
}

async function resolveProjectTreeHatsToBatches(
  projectContract: any,
  projectHats: any[],
  roleHatIndex: Map<string, string> | undefined
): Promise<Array<{ projectId: string; hats: any[] }>> {
  const projectHatsWithId = (
    await Promise.all(
      projectHats.map(async (hat: any) => {
        try {
          const projectId = await resolveEntityIdFromWornHat(
            projectContract,
            hat,
            roleHatIndex
          )
          if (projectId == null || projectId === '') {
            return null
          }
          return {
            ...hat,
            projectId,
          }
        } catch {
          return null
        }
      })
    )
  ).filter((result) => result !== null)

  return groupHatsByProjectId(projectHatsWithId as any)
}

function mergeProjectLists(
  batches: Array<Array<{ projectId: string; hats: any[] }>>
): Array<{ projectId: string; hats: any[] }> {
  const byProject = new Map<string, Map<string, any>>()

  for (const batch of batches) {
    for (const { projectId, hats } of batch) {
      if (!byProject.has(projectId)) {
        byProject.set(projectId, new Map())
      }
      const hatMap = byProject.get(projectId)!
      for (const h of hats) {
        if (h?.id && !hatMap.has(h.id)) {
          hatMap.set(h.id, h)
        }
      }
    }
  }

  return Array.from(byProject.entries()).map(([projectId, hatMap]) => ({
    projectId,
    hats: Array.from(hatMap.values()),
  }))
}

export function useProjectWearer(
  projectContract: any,
  selectedChain: any,
  wearerAddressOrAddresses: string | string[] | null | undefined
) {
  const [wornProjectHats, setWornProjectHats] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  const addresses = normalizeWearerAddresses(wearerAddressOrAddresses)
  const addressKey = addresses.slice().sort().join(',')

  // thirdweb's getContract() often yields a new object identity without semantic change;
  // depending on `projectContract` in useEffect can cause an infinite update loop.
  const projectContractRef = useRef(projectContract)
  const selectedChainRef = useRef(selectedChain)
  projectContractRef.current = projectContract
  selectedChainRef.current = selectedChain

  const contractAddress =
    typeof projectContract?.address === 'string'
      ? projectContract.address.toLowerCase()
      : undefined
  const chainId = selectedChain?.id

  useEffect(() => {
    let cancelled = false

    async function getWearerProjectHats() {
      const pc = projectContractRef.current
      const sc = selectedChainRef.current
      try {
        setIsLoading(true)
        setWornProjectHats(undefined)
        if (addresses.length === 0) {
          if (!cancelled) {
            setWornProjectHats([])
          }
          return
        }

        const hatLists = await Promise.all(
          addresses.map((addr) => fetchProjectTreeHatsForAddress(sc, addr))
        )
        if (cancelled) return

        if (!hatLists.some((list) => list.length > 0)) {
          if (!cancelled) {
            setWornProjectHats([])
          }
          return
        }

        const firstPass = await Promise.all(
          hatLists.map((list) =>
            Promise.all(
              list.map((hat) =>
                resolveEntityIdFromWornHat(pc, hat, undefined)
              )
            )
          )
        )
        if (cancelled) return

        const needsFullRoleIndex = firstPass.some((row) =>
          row.some((id) => id == null)
        )

        let batches: Array<Array<{ projectId: string; hats: any[] }>>

        if (!needsFullRoleIndex) {
          batches = hatLists.map((list, i) => {
            const withIds = list
              .map((hat, j) => {
                const projectId = firstPass[i][j]
                if (projectId == null || projectId === '') return null
                return { ...hat, projectId }
              })
              .filter(Boolean) as any[]
            return groupHatsByProjectId(withIds)
          })
        } else {
          let roleHatIndex = await buildRoleHatToEntityIndex(pc)
          if (roleHatIndex.size === 0 && !cancelled) {
            await new Promise((r) => setTimeout(r, 450))
            if (!cancelled) {
              roleHatIndex = await buildRoleHatToEntityIndex(pc)
            }
          }
          if (cancelled) return
          batches = await Promise.all(
            hatLists.map((projectHats) =>
              resolveProjectTreeHatsToBatches(pc, projectHats, roleHatIndex)
            )
          )
        }

        if (cancelled) return
        setWornProjectHats(mergeProjectLists(batches))
      } catch (err) {
        console.log(err)
        if (!cancelled) {
          setWornProjectHats((prev) =>
            Array.isArray(prev) && prev.length > 0 ? prev : []
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    if (projectContract && selectedChain) {
      getWearerProjectHats()
    } else {
      if (addresses.length > 0) {
        setWornProjectHats(undefined)
        setIsLoading(true)
      } else {
        setWornProjectHats([])
        setIsLoading(false)
      }
    }

    return () => {
      cancelled = true
    }
    // Primitives only: contract/chain objects from thirdweb are unstable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addressKey tracks wallet list; refs hold latest contract
  }, [contractAddress, chainId, addressKey])

  return { userProjects: wornProjectHats, isLoading }
}
