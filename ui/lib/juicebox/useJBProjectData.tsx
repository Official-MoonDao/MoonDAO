//Juicebox V5
import JBV5Token from 'const/abis/JBV5Token.json'
import {
  JB_NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from 'const/config'
import { BigNumber } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import useContract from '../thirdweb/hooks/useContract'
import { projectQuery } from './subgraph'
import useJBProjectTrendingPercentageIncrease from './useJBProjectTrendingPercentageIncrease'

/** Juicebox project ids are positive uint256; null/0/invalid must not be passed to `readContract`. */
function normalizedJuiceboxProjectId(projectId: unknown): number | null {
  if (projectId == null || projectId === '') return null
  const n = Number(projectId)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  return n
}

export default function useJBProjectData({
  projectId,
  jbControllerContract,
  jbDirectoryContract,
  jbTokensContract,
  projectMetadata,
  projectSubgraphData,
  _primaryTerminalAddress,
  _token,
  _ruleset,
  stage,
}: {
  projectId: number | undefined
  jbControllerContract: any
  jbDirectoryContract: any
  jbTokensContract: any
  projectMetadata?: any
  projectSubgraphData?: any
  _primaryTerminalAddress?: string
  _token?: any
  _ruleset?: any
  stage?: number
}) {
  const { selectedChain } = useContext(ChainContextV5)

  const [metadata, setMetadata] = useState<any>(projectMetadata)
  const [ruleset, setRuleset] = useState<any>(_ruleset)
  const [token, setToken] = useState<any>(
    _token || {
      tokenAddress: '',
      tokenName: '',
      tokenSymbol: '',
      tokenSupply: '',
      reservedTokens: '',
      reservedRate: '',
    }
  )
  const [subgraphData, setSubgraphData] = useState<any>(projectSubgraphData)

  const last7DaysPercent = useJBProjectTrendingPercentageIncrease(
    BigNumber.from(subgraphData?.volume ?? 0),
    BigNumber.from(subgraphData?.trendingVolume ?? 0)
  )
  const [primaryTerminalAddress, setPrimaryTerminalAddress] = useState<string>(
    _primaryTerminalAddress || ZERO_ADDRESS
  )

  const tokenContract = useContract({
    chain: selectedChain,
    address: token?.tokenAddress,
    abi: JBV5Token,
  })

  //Metadata
  useEffect(() => {
    async function getProjectMetadata() {
      const jbPid = normalizedJuiceboxProjectId(projectId)
      if (jbPid == null) return
      try {
        const metadataURI: any = await readContract({
          contract: jbControllerContract,
          method: 'uriOf' as string,
          params: [jbPid],
        })
        if (!metadataURI) return
        const res = await fetch(metadataURI)
        if (!res.ok) return
        const data = await res.json()
        setMetadata(data)
      } catch (err) {
        console.error('Failed to fetch project metadata:', err)
      }
    }

    if (jbControllerContract && !projectMetadata && projectId !== undefined)
      getProjectMetadata()
  }, [jbControllerContract, projectId, projectMetadata])

  //Ruleset, refresh if stage changes
  useEffect(() => {
    async function getProjectRuleset() {
      const jbPid = normalizedJuiceboxProjectId(projectId)
      if (jbPid == null) return
      try {
        const rs: any = await readContract({
          contract: jbControllerContract,
          method: 'currentRulesetOf' as string,
          params: [jbPid],
        })
        setRuleset(rs)
      } catch (err) {
        console.error(
          'Failed to read Juicebox ruleset (currentRulesetOf):',
          { projectId: jbPid, err }
        )
      }
    }
    if (jbControllerContract && projectId !== undefined && stage !== undefined)
      getProjectRuleset()
  }, [jbControllerContract, projectId, stage])

  //Token Address
  useEffect(() => {
    async function getProjectToken() {
      const jbPid = normalizedJuiceboxProjectId(projectId)
      if (jbPid == null) return
      try {
        const result: any = await readContract({
          contract: jbTokensContract,
          method: 'tokenOf' as string,
          params: [jbPid],
        })
        // Defensive: under occasional RPC hiccups thirdweb's batched eth_call
        // can resolve with `undefined`, which then crashes viem's
        // `decodeAbiParameters` deep inside `createCursor` ("Cannot read
        // properties of undefined (reading 'buffer')"). Treat anything that
        // isn't a real address string as a no-op so we don't poison the
        // existing token state (which may already contain a valid address
        // from server-side props).
        if (typeof result !== 'string' || !result.startsWith('0x')) return
        setToken((prev: any) => ({ ...prev, tokenAddress: result }))
      } catch (err) {
        console.error('Failed to read Juicebox project token (tokenOf):', {
          projectId: jbPid,
          err,
        })
      }
    }

    // The server already resolves `tokenOf` in `fetchMissionContracts` and
    // forwards the result via `_token.tokenAddress`. Skip the redundant
    // client-side read whenever we already have a valid (non-zero) address —
    // it eliminates an extra eth_call per mission load and avoids the noisy
    // viem decode error users were seeing on the Overview Mission page.
    const hasServerToken =
      typeof token?.tokenAddress === 'string' &&
      token.tokenAddress.startsWith('0x') &&
      token.tokenAddress !== ZERO_ADDRESS
    if (hasServerToken) return

    if (jbTokensContract && projectId) getProjectToken()
  }, [projectId, jbTokensContract, token?.tokenAddress])

  //Token Data
  useEffect(() => {
    async function getTokenData() {
      if (!tokenContract) return
      const [nameResult, symbolResult, supplyResult] = await Promise.allSettled(
        [
          readContract({
            contract: tokenContract,
            method: 'name' as string,
            params: [],
          }),
          readContract({
            contract: tokenContract,
            method: 'symbol' as string,
            params: [],
          }),
          readContract({
            contract: tokenContract,
            method: 'totalSupply' as string,
            params: [],
          }),
        ]
      )
      if (nameResult.status === 'fulfilled' && nameResult.value)
        setToken((prev: any) => ({ ...prev, tokenName: nameResult.value }))
      if (symbolResult.status === 'fulfilled' && symbolResult.value)
        setToken((prev: any) => ({ ...prev, tokenSymbol: symbolResult.value }))
      if (supplyResult.status === 'fulfilled' && supplyResult.value)
        setToken((prev: any) => ({ ...prev, tokenSupply: supplyResult.value }))
    }
    if (tokenContract) getTokenData()
  }, [tokenContract])

  //Project and Payment terminal Subgraph Data
  useEffect(() => {
    async function getSubgraphData() {
      if (projectId === undefined) return
      try {
        const res = await fetch('/api/juicebox/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: projectQuery(projectId),
          }),
        })
        const data = await res.json()
        const projectSubgraphData = data.projects?.items?.[0]
        setSubgraphData(projectSubgraphData)
      } catch (error) {
        console.error(error)
      }
    }

    if (projectId !== undefined) getSubgraphData()
  }, [projectId])

  //Project Directory Data
  useEffect(() => {
    async function getProjectDirectoryData() {
      const jbPid = normalizedJuiceboxProjectId(projectId)
      if (jbPid == null) return

      // Bounded retry.  Without a cap, a project that hasn't yet been wired
      // up to a primary terminal (e.g. a freshly-deployed mission, or a
      // bogus projectId) sends this effect into an infinite RPC loop.
      const maxAttempts = 5
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const fetched: any = await readContract({
            contract: jbDirectoryContract,
            method: 'primaryTerminalOf' as string,
            params: [jbPid, JB_NATIVE_TOKEN_ADDRESS],
          })

          if (fetched !== ZERO_ADDRESS && fetched) {
            setPrimaryTerminalAddress(fetched)
            return
          }
          console.warn(
            `Retrieved zero or invalid address for project ${projectId} (attempt ${
              attempt + 1
            }/${maxAttempts})`
          )
        } catch (error) {
          console.error(
            `Error getting primary terminal for project ${projectId}:`,
            error
          )
        }
      }

      console.error(
        `Failed to get valid primary terminal for project ${projectId} after ${maxAttempts} attempts`
      )
      setPrimaryTerminalAddress(ZERO_ADDRESS)
    }

    // Only fetch if _primaryTerminalAddress was not provided
    if (jbDirectoryContract && projectId && !_primaryTerminalAddress) {
      getProjectDirectoryData()
    }
  }, [
    jbDirectoryContract,
    projectId,
    token?.tokenAddress,
    _primaryTerminalAddress,
  ])

  return {
    metadata,
    ruleset,
    token,
    subgraphData: {
      ...subgraphData,
      last7DaysPercent,
    },
    primaryTerminalAddress,
  }
}
