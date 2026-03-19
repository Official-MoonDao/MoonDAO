import { PROJECT_HAT_TREE_IDS } from 'const/config'
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

async function loadProjectsForWearer(
  projectContract: any,
  selectedChain: any,
  wearerAddress: string,
  roleHatIndex: Map<string, string>
): Promise<Array<{ projectId: string; hats: any[] }>> {
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

  const expectedTree = PROJECT_HAT_TREE_IDS[getChainSlug(selectedChain)]
  const projectHats = hats.currentHats.filter((hat: any) =>
    hat.tree?.id && expectedTree ? hatTreeMatches(hat.tree.id, expectedTree) : false
  )

  const projectHatsWithId = await Promise.all(
    projectHats.map(async (hat: any) => {
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
    })
  ).then((results) => results.filter((result) => result !== null))

  const uniqueProjects = [
    ...new Set(projectHatsWithId.map((hat: any) => hat.projectId)),
  ].map((projectId: any) => {
    return {
      projectId: projectId,
      hats: projectHatsWithId.filter(
        (hat: any) => +hat.projectId === +projectId
      ),
    }
  })

  return uniqueProjects
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

  useEffect(() => {
    async function getWearerProjectHats() {
      try {
        setIsLoading(true)
        setWornProjectHats(undefined)
        if (addresses.length === 0) {
          setWornProjectHats([])
          setIsLoading(false)
          return
        }

        const roleHatIndex = await buildRoleHatToEntityIndex(projectContract)
        const batches = await Promise.all(
          addresses.map((addr) =>
            loadProjectsForWearer(
              projectContract,
              selectedChain,
              addr,
              roleHatIndex
            )
          )
        )

        setWornProjectHats(mergeProjectLists(batches))
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
      if (addresses.length > 0) {
        setWornProjectHats(undefined)
        setIsLoading(true)
      } else {
        setWornProjectHats([])
        setIsLoading(false)
      }
    }
  }, [projectContract, selectedChain, addressKey])

  return { userProjects: wornProjectHats, isLoading }
}
