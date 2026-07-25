import JBV5Token from 'const/abis/JBV5Token.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import { JBV5_TOKENS_ADDRESS, MISSION_CREATOR_ADDRESSES } from 'const/config'
import { useEffect, useMemo, useState } from 'react'
import { getContract, type Chain } from 'thirdweb'
import { deprizeReadChain, deprizeReadClient, rpcRead } from '@/lib/deprize/read'
import { getChainSlug } from '@/lib/thirdweb/chain'

const ZERO = '0x0000000000000000000000000000000000000000'

/**
 * Extra MissionCreators to scan when resolving jbProjectId → mission id.
 * Sepolia DePrize fixtures sometimes use a dedicated creator outside the
 * app-wide deployment (see docs/DEPRIZE_QA.md).
 */
const EXTRA_MISSION_CREATORS: Partial<Record<string, readonly string[]>> = {
  sepolia: ['0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1'],
}

export type DePrizeLaunchpadToken = {
  /** ERC-20 symbol of the JB project token (e.g. FRANKT, OVERVIEW). */
  symbol: string | undefined
  /** ERC-20 name when available. */
  name: string | undefined
  tokenAddress: string | undefined
  /** MoonDAO launchpad mission id for this JB project, when found. */
  missionId: number | undefined
  /** `/mission/{id}` when `missionId` is known. */
  missionHref: string | undefined
  loading: boolean
}

async function resolveMissionId(
  projectId: number,
  chainSlug: string,
  readChain: ReturnType<typeof deprizeReadChain>,
): Promise<number | undefined> {
  const creators = [
    MISSION_CREATOR_ADDRESSES[chainSlug],
    ...(EXTRA_MISSION_CREATORS[chainSlug] ?? []),
  ].filter((a): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a))

  // De-dupe while preserving order.
  const seen = new Set<string>()
  for (const address of creators) {
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    try {
      const creator = getContract({
        client: deprizeReadClient,
        chain: readChain,
        address,
        abi: ((MissionCreatorABI as any).abi ?? MissionCreatorABI) as any,
      })
      const tableAddr = await rpcRead<string>({
        contract: creator,
        method: 'missionTable' as string,
        params: [],
      })
      if (typeof tableAddr !== 'string' || !tableAddr.startsWith('0x') || /^0x0+$/.test(tableAddr)) {
        continue
      }
      const table = getContract({
        client: deprizeReadClient,
        chain: readChain,
        address: tableAddr,
        abi: ((MissionTableABI as any).abi ?? MissionTableABI) as any,
      })
      // currId is the next id to mint; registered missions are 1..currId-1.
      const curr = await rpcRead<bigint>({
        contract: table,
        method: 'currId' as string,
        params: [],
      })
      const max = Number(curr)
      if (!Number.isFinite(max) || max <= 1) continue

      for (let id = 1; id < max; id++) {
        const pid = await rpcRead<bigint>({
          contract: creator,
          method: 'missionIdToProjectId' as string,
          params: [BigInt(id)],
        })
        if (Number(pid) === projectId) return id
      }
    } catch {
      /* try next creator */
    }
  }
  return undefined
}

/**
 * Resolve the Juicebox project token + launchpad mission for a DePrize prize pool.
 * The 5% bet slice pays into `jbProjectId` and mints this token to the bettor —
 * it is NOT always $OVERVIEW (only when the DePrize is bound to that launchpad).
 */
export function useDePrizeLaunchpadToken(
  jbProjectId: number | bigint | undefined,
  chain: Chain,
): DePrizeLaunchpadToken {
  const projectId =
    jbProjectId === undefined || jbProjectId === null
      ? undefined
      : Number(jbProjectId)
  const chainSlug = getChainSlug(chain)

  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

  const tokens = useMemo(
    () =>
      getContract({
        client: deprizeReadClient,
        chain: readChain,
        address: JBV5_TOKENS_ADDRESS,
        abi: JBV5Tokens.abi as any,
      }),
    [readChain],
  )

  const [tokenAddress, setTokenAddress] = useState<string | undefined>()
  const [symbol, setSymbol] = useState<string | undefined>()
  const [name, setName] = useState<string | undefined>()
  const [missionId, setMissionId] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTokenAddress(undefined)
    setSymbol(undefined)
    setName(undefined)
    setMissionId(undefined)

    if (projectId === undefined || !Number.isFinite(projectId) || projectId <= 0) {
      setLoading(false)
      return
    }

    ;(async () => {
      setLoading(true)
      try {
        const [addr, mid] = await Promise.all([
          rpcRead<string>({
            contract: tokens,
            method: 'tokenOf' as string,
            params: [BigInt(projectId)],
          }).catch(() => ''),
          resolveMissionId(projectId, chainSlug, readChain),
        ])
        if (cancelled) return
        if (mid !== undefined) setMissionId(mid)

        if (typeof addr !== 'string' || !addr.startsWith('0x') || /^0x0+$/.test(addr) || addr === ZERO) {
          setTokenAddress(undefined)
          return
        }
        setTokenAddress(addr)

        const token = getContract({
          client: deprizeReadClient,
          chain: readChain,
          address: addr,
          abi: JBV5Token as any,
        })
        const [sym, nm] = await Promise.all([
          rpcRead<string>({ contract: token, method: 'symbol' as string, params: [] }).catch(
            () => '',
          ),
          rpcRead<string>({ contract: token, method: 'name' as string, params: [] }).catch(
            () => '',
          ),
        ])
        if (cancelled) return
        setSymbol(typeof sym === 'string' && sym.trim() ? sym.trim() : undefined)
        setName(typeof nm === 'string' && nm.trim() ? nm.trim() : undefined)
      } catch {
        if (!cancelled) {
          setTokenAddress(undefined)
          setSymbol(undefined)
          setName(undefined)
          setMissionId(undefined)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, tokens, readChain, chainSlug])

  return {
    symbol,
    name,
    tokenAddress,
    missionId,
    missionHref: missionId !== undefined ? `/mission/${missionId}` : undefined,
    loading,
  }
}
