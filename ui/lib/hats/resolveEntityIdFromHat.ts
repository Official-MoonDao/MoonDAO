import { readContract } from 'thirdweb'

const MAX_ADMIN_DEPTH = 24
/** Cap entity count when scanning role hats (teams + projects on-chain) */
const MAX_ROLE_INDEX_ENTITIES = 200
/** Parallel team/project ids per RPC batch (3 reads each) */
const ROLE_INDEX_CHUNK = 20

function hatIdToUint256Param(id: string): bigint | string {
  try {
    if (typeof id === 'string' && id.startsWith('0x')) {
      return BigInt(id)
    }
    return BigInt(id)
  } catch {
    return id
  }
}

function hatKeyFromId(id: unknown): string | null {
  try {
    if (id == null) return null
    return BigInt(id as string).toString()
  } catch {
    return null
  }
}

function safeEntityCap(supplyRaw: unknown): number {
  const n = Number(supplyRaw as bigint | number | string)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), MAX_ROLE_INDEX_ENTITIES)
}

/**
 * Map team/project role hat id (decimal string key) → entity token id.
 * Needed because some legacy teams (notably Executive Branch, token id 0) do not
 * populate `adminHatToTokenId` for their admin hat, so walking the hat tree alone
 * never resolves managers/members to that NFT.
 *
 * Uses chunked parallel reads so the UI does not block on hundreds of sequential RPCs.
 */
export async function buildRoleHatToEntityIndex(
  entityContract: any
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const supplyRaw = await readContract({
      contract: entityContract,
      method: 'totalSupply' as string,
      params: [],
    })
    const cap = safeEntityCap(supplyRaw)
    if (cap === 0) return map

    for (let start = 0; start < cap; start += ROLE_INDEX_CHUNK) {
      const end = Math.min(start + ROLE_INDEX_CHUNK, cap)
      const chunkResults = await Promise.all(
        Array.from({ length: end - start }, (_, i) => {
          const tid = start + i
          const tokenParam = BigInt(tid)
          return Promise.all([
            readContract({
              contract: entityContract,
              method: 'teamAdminHat' as string,
              params: [tokenParam],
            }),
            readContract({
              contract: entityContract,
              method: 'teamManagerHat' as string,
              params: [tokenParam],
            }),
            readContract({
              contract: entityContract,
              method: 'teamMemberHat' as string,
              params: [tokenParam],
            }),
          ]).then(([adminHat, managerHat, memberHat]) => ({
            tid,
            adminHat,
            managerHat,
            memberHat,
          }))
        })
      )

      for (const { tid, adminHat, managerHat, memberHat } of chunkResults) {
        const tokenIdStr = String(tid)
        for (const h of [adminHat, managerHat, memberHat]) {
          const k = hatKeyFromId(h)
          if (k && k !== '0' && !map.has(k)) {
            map.set(k, tokenIdStr)
          }
        }
      }
    }
  } catch (e) {
    console.warn('buildRoleHatToEntityIndex failed, using adminHatToTokenId only:', e)
  }

  return map
}

/**
 * Walk from the worn hat up the admin chain; the Team/Project contract only
 * stores adminHatToTokenId for the entity's admin hat.
 * Falls back to role-hat index when adminHatToTokenId is missing (legacy teams).
 */
export async function resolveEntityIdFromWornHat(
  entityContract: any,
  hat: { id: string; admin?: any },
  roleHatIndex?: Map<string, string>
): Promise<string | null> {
  let node: any = hat
  let depth = 0
  while (node?.id && depth < MAX_ADMIN_DEPTH) {
    const tokenId = await readContract({
      contract: entityContract,
      method: 'adminHatToTokenId' as string,
      params: [hatIdToUint256Param(node.id)],
    })
    if (+tokenId.toString() !== 0) {
      return tokenId.toString()
    }
    node = node.admin
    depth++
  }

  if (roleHatIndex) {
    node = hat
    depth = 0
    while (node?.id && depth < MAX_ADMIN_DEPTH) {
      const k = hatKeyFromId(node.id)
      if (k && roleHatIndex.has(k)) {
        return roleHatIndex.get(k)!
      }
      node = node.admin
      depth++
    }
  }

  return null
}
