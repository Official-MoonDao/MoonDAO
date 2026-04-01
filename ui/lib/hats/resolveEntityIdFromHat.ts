import { readContract } from 'thirdweb'

const MAX_ADMIN_DEPTH = 24
/** Cap entity count when scanning role hats (teams + projects on-chain) */
const MAX_ROLE_INDEX_ENTITIES = 200
/**
 * How many token ids we resolve in parallel. Each id uses 3 reads (admin/manager/member),
 * so keep this small — large bursts (e.g. 20×3) can rate-limit the RPC and make later
 * `adminHatToTokenId` calls fail, wiping teams/projects from the UI.
 */
const ROLE_INDEX_TOKEN_PARALLELISM = 8

/** Avoid re-scanning the same contract on every hook run / navigation */
const ROLE_INDEX_CACHE_TTL_MS = 5 * 60 * 1000
const TOKEN_ZERO_ROLE_KEYS_TTL_MS = 5 * 60 * 1000

function roleIndexCacheKey(entityContract: any): string | null {
  try {
    const addr = entityContract?.address
    const chainId = entityContract?.chain?.id
    if (
      typeof addr === 'string' &&
      /^0x[a-fA-F0-9]{40}$/i.test(addr) &&
      chainId != null
    ) {
      return `${chainId}:${addr.toLowerCase()}`
    }
  } catch {
    /* ignore */
  }
  return null
}

const roleIndexCache = new Map<
  string,
  { map: Map<string, string>; expiresAt: number }
>()
const roleIndexInflight = new Map<string, Promise<Map<string, string>>>()

const tokenZeroRoleKeysCache = new Map<
  string,
  { keys: Set<string>; expiresAt: number }
>()
const tokenZeroRoleKeysInflight = new Map<string, Promise<Set<string>>>()

function cloneRoleIndex(map: Map<string, string>): Map<string, string> {
  return new Map(map)
}

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
    if (typeof id === 'bigint') return id.toString()
    if (typeof id === 'number' && Number.isFinite(id)) {
      return BigInt(Math.trunc(id)).toString()
    }
    const s = String(id).trim()
    if (s === '') return null
    return BigInt(s).toString()
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
 * Role hat ids registered for entity token id 0 (Executive Branch on Team, etc.).
 * Cached cheaply — fixes admin-hat wearers when teamAdminHat(0) is unset on-chain so the
 * full role index never records the real admin hat id.
 */
async function loadTokenZeroRoleHatKeySetUncached(
  entityContract: any
): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const method of ['teamAdminHat', 'teamManagerHat', 'teamMemberHat'] as const) {
    try {
      const h = await readContract({
        contract: entityContract,
        method: method as string,
        params: [0n],
      })
      const k = hatKeyFromId(h)
      if (k && k !== '0') keys.add(k)
    } catch {
      /* token 0 missing or read failed */
    }
  }
  return keys
}

async function getCachedTokenZeroRoleHatKeys(
  entityContract: any
): Promise<Set<string>> {
  const key = roleIndexCacheKey(entityContract)
  if (!key) {
    return loadTokenZeroRoleHatKeySetUncached(entityContract)
  }

  const hit = tokenZeroRoleKeysCache.get(key)
  if (hit && hit.expiresAt > Date.now() && hit.keys.size > 0) {
    return new Set(hit.keys)
  }
  if (hit) tokenZeroRoleKeysCache.delete(key)

  const pending = tokenZeroRoleKeysInflight.get(key)
  if (pending) {
    try {
      return new Set(await pending)
    } catch {
      return new Set()
    }
  }

  const promise = (async () => {
    try {
      return await loadTokenZeroRoleHatKeySetUncached(entityContract)
    } finally {
      tokenZeroRoleKeysInflight.delete(key)
    }
  })()

  tokenZeroRoleKeysInflight.set(key, promise)
  try {
    const keys = await promise
    if (keys.size > 0) {
      tokenZeroRoleKeysCache.set(key, {
        keys: new Set(keys),
        expiresAt: Date.now() + TOKEN_ZERO_ROLE_KEYS_TTL_MS,
      })
    }
    return new Set(keys)
  } catch {
    return new Set()
  }
}

async function readTeamRoleHat(
  entityContract: any,
  method: string,
  tokenParam: bigint
): Promise<unknown> {
  try {
    return await readContract({
      contract: entityContract,
      method: method as string,
      params: [tokenParam],
    })
  } catch {
    return null
  }
}

/**
 * Map team/project role hat id (decimal string key) → entity token id.
 * Needed because some legacy teams (notably Executive Branch, token id 0) do not
 * populate `adminHatToTokenId` for their admin hat, so walking the hat tree alone
 * never resolves managers/members to that NFT.
 *
 * Uses chunked parallel reads so the UI does not block on hundreds of sequential RPCs.
 *
 * Results are cached per chain + contract address so Teams + Projects hooks and re-renders
 * do not each pay the full RPC cost.
 */
export async function buildRoleHatToEntityIndex(
  entityContract: any
): Promise<Map<string, string>> {
  const key = roleIndexCacheKey(entityContract)
  if (!key) {
    return cloneRoleIndex(await scanRoleHatToEntityIndexUncached(entityContract))
  }

  const hit = roleIndexCache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    // Never use a cached empty index: that usually means RPC/rate-limit noise, and it
    // poisons Executive Branch + other role-hat fallbacks for the whole TTL.
    if (hit.map.size > 0) {
      return cloneRoleIndex(hit.map)
    }
    roleIndexCache.delete(key)
  }

  const pending = roleIndexInflight.get(key)
  if (pending) {
    try {
      return cloneRoleIndex(await pending)
    } catch (e) {
      console.warn('Shared role-hat index build failed; will retry:', e)
    }
  }

  const promise = (async () => {
    try {
      const map = await scanRoleHatToEntityIndexUncached(entityContract)
      if (map.size > 0) {
        roleIndexCache.set(key, {
          map: new Map(map),
          expiresAt: Date.now() + ROLE_INDEX_CACHE_TTL_MS,
        })
      }
      return map
    } finally {
      roleIndexInflight.delete(key)
    }
  })()

  roleIndexInflight.set(key, promise)
  try {
    return cloneRoleIndex(await promise)
  } catch (e) {
    console.warn('buildRoleHatToEntityIndex failed:', e)
    return new Map()
  }
}

async function scanRoleHatToEntityIndexUncached(
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

    for (let start = 0; start < cap; start += ROLE_INDEX_TOKEN_PARALLELISM) {
      const end = Math.min(start + ROLE_INDEX_TOKEN_PARALLELISM, cap)
      const chunkResults = await Promise.all(
        Array.from({ length: end - start }, (_, i) => {
          const tid = start + i
          const tokenParam = BigInt(tid)
          // Per-call try/catch: one revert (e.g. legacy token 0 + strict admin read) must not
          // drop the entire index — Executive Branch often still has manager/member hat reads.
          return Promise.all([
            readTeamRoleHat(entityContract, 'teamAdminHat', tokenParam),
            readTeamRoleHat(entityContract, 'teamManagerHat', tokenParam),
            readTeamRoleHat(entityContract, 'teamMemberHat', tokenParam),
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
    try {
      const tokenId = await readContract({
        contract: entityContract,
        method: 'adminHatToTokenId' as string,
        params: [hatIdToUint256Param(node.id)],
      })
      if (+String(tokenId) !== 0) {
        return String(tokenId)
      }
    } catch {
      // RPC throttle / transient errors: treat as unmapped and walk the admin chain
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

  const zeroKeys = await getCachedTokenZeroRoleHatKeys(entityContract)
  if (zeroKeys.size > 0) {
    node = hat
    depth = 0
    while (node?.id && depth < MAX_ADMIN_DEPTH) {
      const k = hatKeyFromId(node.id)
      if (k && zeroKeys.has(k)) {
        return '0'
      }
      node = node.admin
      depth++
    }
  }

  return null
}
