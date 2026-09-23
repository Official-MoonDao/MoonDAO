import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import { DEPRIZE_REGISTRY_ADDRESSES } from 'const/config'
import { getContract } from 'thirdweb'
import type { RegistryProjectLookup } from '@/lib/deprize/patrons-query'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'

/**
 * Reads `getDePrize(id).jbProjectId` so the patrons API cannot be pointed at
 * an arbitrary Juicebox project. Returns unknown-project when the id is
 * unregistered or has no JB project.
 */
export async function readRegistryJbProjectId(
  chainSlug: string,
  chainId: number,
  deprizeId: number
): Promise<RegistryProjectLookup> {
  const address = DEPRIZE_REGISTRY_ADDRESSES[chainSlug] ?? ''
  if (!address) return { ok: false, error: 'registry-unconfigured' }

  try {
    const registry = getContract({
      client: deprizeReadClient,
      chain: deprizeReadChain(chainId),
      address,
      abi: DePrizeRegistryABI as any,
    })
    const probedState = Number(
      await rpcRead<bigint | number>({
        contract: registry,
        method: 'state' as string,
        params: [BigInt(deprizeId)],
      })
    )
    if (probedState === 0) return { ok: false, error: 'unknown-project' }

    const dp = await rpcRead<{ jbProjectId?: bigint | number | string }>({
      contract: registry,
      method: 'getDePrize' as string,
      params: [BigInt(deprizeId)],
    })
    const projectId = BigInt(dp.jbProjectId ?? 0)
    if (projectId <= 0n) return { ok: false, error: 'unknown-project' }
    return { ok: true, projectId }
  } catch {
    return { ok: false, error: 'registry-unavailable' }
  }
}
