/**
 * Team-centric approach: iterate through teams and projects, check if the
 * user's address appears as a wearer in each entity's hat tree.
 * More reliable than get-wearer when subgraph mapping has issues.
 */
import TeamABI from 'const/abis/Team.json'
import ProjectABI from 'const/abis/Project.json'
import {
  PROJECT_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
  PROJECT_ADDRESSES,
  MOONDAO_HAT_TREE_IDS,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import type { Chain } from 'thirdweb/chains'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import { getChainById, getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import queryTable from '@/lib/tableland/queryTable'
import { processHatsWithTeamData } from '@/lib/hats/batchHatOperations'

function collectWearerAddresses(hat: any): string[] {
  const addresses: string[] = []
  if (!hat) return addresses

  const addWearers = (h: any) => {
    if (h?.wearers && Array.isArray(h.wearers)) {
      h.wearers.forEach((w: any) => {
        const addr = w?.id ?? w?.address ?? w
        if (typeof addr === 'string' && addr.startsWith('0x')) {
          addresses.push(addr.toLowerCase())
        }
      })
    }
    if (h?.subHats && Array.isArray(h.subHats)) {
      h.subHats.forEach((sub: any) => addWearers(sub))
    }
  }

  addWearers(hat)
  return [...new Set(addresses)]
}

export type UserMemberships = {
  teamIds: string[]
  projectIds: string[]
  /** Projects with names for nav display */
  projects?: { projectId: string; name: string }[]
  /** Teams with names for nav display */
  teams?: { teamId: string; name: string }[]
}

export async function getUserMemberships(
  chainId: number,
  wearerAddress: string
): Promise<UserMemberships> {
  const normalizedAddress = wearerAddress.toLowerCase()
  const chain = getChainById(chainId)
  if (!chain) return { teamIds: [], projectIds: [], projects: [], teams: [] }

  const chainSlug = getChainSlug(chain)
  const teamTableName = TEAM_TABLE_NAMES[chainSlug]
  const projectTableName = PROJECT_TABLE_NAMES[chainSlug]
  const teamContract = getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[chainSlug],
    chain,
    abi: TeamABI as any,
  })
  const projectContract = getContract({
    client: serverClient,
    address: PROJECT_ADDRESSES[chainSlug],
    chain,
    abi: ProjectABI as any,
  })

  const teamIds: string[] = []
  const projectIds: string[] = []

  try {
    let teamRows: any[] = []
    let projectRows: any[] = []
    let wearerFirstTeamIds: string[] = []

    const maxTeams = 60
    const maxProjects = 40
    if (teamTableName) {
      teamRows =
        (await queryTable(
          chain,
          `SELECT id, name FROM ${teamTableName} ORDER BY id DESC LIMIT ${maxTeams}`
        )) ?? []
    }

    const moonDaoTreeId = MOONDAO_HAT_TREE_IDS[chainSlug]
    if (moonDaoTreeId) {
      try {
        const wearerData = await hatsSubgraphClient.getWearer({
          chainId,
          wearerAddress: normalizedAddress as `0x${string}`,
          props: {
            currentHats: {
              props: {
                tree: {},
                admin: { admin: { admin: {} } },
              },
            },
          },
        })
        if (wearerData?.currentHats?.length) {
          // Normalize tree ID comparison (subgraph may return hex or decimal)
          const moonDaoTreeNum = BigInt(moonDaoTreeId)
          const moondaoHats = wearerData.currentHats.filter((hat: any) => {
            const treeId = hat?.tree?.id
            if (!treeId) return false
            try {
              return BigInt(treeId) === moonDaoTreeNum
            } catch {
              return String(treeId) === String(moonDaoTreeId)
            }
          })
          if (moondaoHats.length > 0) {
            const hatsWithTeams = await processHatsWithTeamData(chain, moondaoHats)
            wearerFirstTeamIds = [...new Set(hatsWithTeams.map((h: any) => h.teamId).filter(Boolean))]
          }
        }
      } catch (wearerErr) {
        console.warn('[getUserMemberships] Wearer-first team fetch failed, using fallback:', wearerErr)
      }
    }
    if (projectTableName) {
      projectRows =
        (await queryTable(
          chain,
          `SELECT id, MDP, name FROM ${projectTableName} ORDER BY id DESC LIMIT ${maxProjects}`
        )) ?? []
    }

    const checkTeamHats = async (teamId: number) => {
      try {
        const adminHatId = await readContract({
          contract: teamContract,
          method: 'teamAdminHat' as string,
          params: [teamId],
        })
        if (!adminHatId || adminHatId.toString() === '0') return false

        const hat = await hatsSubgraphClient.getHat({
          chainId,
          hatId: adminHatId.toString(),
          props: {
            wearers: { props: {} },
            subHats: {
              props: {
                wearers: { props: {} },
                subHats: {
                  props: {
                    wearers: { props: {} },
                  },
                },
              },
            },
          },
        })

        const wearers = collectWearerAddresses(hat)
        return wearers.includes(normalizedAddress)
      } catch {
        return false
      }
    }

    const checkProjectHats = async (projectId: number) => {
      try {
        const adminHatId = await readContract({
          contract: projectContract,
          method: 'teamAdminHat' as string,
          params: [projectId],
        })
        if (!adminHatId || adminHatId.toString() === '0') return false

        const hat = await hatsSubgraphClient.getHat({
          chainId,
          hatId: adminHatId.toString(),
          props: {
            wearers: { props: {} },
            subHats: {
              props: {
                wearers: { props: {} },
                subHats: {
                  props: {
                    wearers: { props: {} },
                  },
                },
              },
            },
          },
        })

        const wearers = collectWearerAddresses(hat)
        return wearers.includes(normalizedAddress)
      } catch {
        return false
      }
    }

    const MAX_TEAMS = 60
    const MAX_PROJECTS = 40

    const teamIdsToCheck = [
      ...new Set(
        teamRows
          .map((r: any) => (r.id != null ? Number(r.id) : NaN))
          .filter((id: number) => !isNaN(id) && id > 0)
          .sort((a: number, b: number) => b - a)
      ),
    ].slice(0, MAX_TEAMS)

    const projectIdsToCheck = [
      ...new Set(
        projectRows
          .flatMap((r: any) => {
            const ids: number[] = []
            if (r.id != null && !isNaN(Number(r.id))) ids.push(Number(r.id))
            if (r.MDP != null && !isNaN(Number(r.MDP))) ids.push(Number(r.MDP))
            return ids
          })
          .filter((id: number) => id > 0)
          .sort((a: number, b: number) => b - a)
      ),
    ].slice(0, MAX_PROJECTS)

    const [teamResults, projectResults] = await Promise.all([
      Promise.all(
        teamIdsToCheck.map(async (id) => ({ id, isMember: await checkTeamHats(id) }))
      ),
      Promise.all(
        projectIdsToCheck.map(async (id) => ({
          id,
          isMember: await checkProjectHats(id),
        }))
      ),
    ])

    // Prefer wearer-first team IDs (finds ALL teams user wears) over iteration (limited to 60)
    if (wearerFirstTeamIds.length > 0) {
      teamIds.push(...wearerFirstTeamIds)
    } else {
      teamResults.forEach(({ id, isMember }) => {
        if (isMember) teamIds.push(String(id))
      })
    }

    const teamIdToName = new Map<number, string>()
    for (const r of teamRows) {
      const n = r?.name
      if (typeof n === 'string' && n.trim()) {
        if (r.id != null) teamIdToName.set(Number(r.id), n.trim())
      }
    }

    const teams: { teamId: string; name: string }[] = [...new Set(teamIds)].map((id) => ({
      teamId: id,
      name: teamIdToName.get(Number(id)) || `Team #${id}`,
    }))

    const idToName = new Map<number, string>()
    for (const r of projectRows) {
      const n = r?.name
      if (typeof n === 'string' && n.trim()) {
        if (r.id != null) idToName.set(Number(r.id), n.trim())
        if (r.MDP != null) idToName.set(Number(r.MDP), n.trim())
      }
    }

    const projects: { projectId: string; name: string }[] = []
    projectResults.forEach(({ id, isMember }) => {
      if (isMember) {
        projectIds.push(String(id))
        const name = idToName.get(id) || `Project #${id}`
        projects.push({ projectId: String(id), name })
      }
    })

    return { teamIds, projectIds, projects, teams }
  } catch (err) {
    console.error('[getUserMemberships] Error:', err)
    return { teamIds: [], projectIds: [], projects: [], teams: [] }
  }
}
