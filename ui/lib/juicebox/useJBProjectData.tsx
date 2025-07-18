//Juicebox V4
import JBV4TokenABI from 'const/abis/JBV4Token.json'
import {
  JB_NATIVE_TOKEN_ADDRESS,
  MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
  ZERO_ADDRESS,
} from 'const/config'
import { BigNumber } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import useContract from '../thirdweb/hooks/useContract'
import { projectQuery } from './subgraph'
import useJBProjectTrendingPercentageIncrease from './useJBProjectTrendingPercentageIncrease'

const primaryTerminalSubgraphClient = createClient({
  url: MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

export default function useJBProjectData({
  projectId,
  jbControllerContract,
  jbDirectoryContract,
  jbTokensContract,
  projectMetadata,
  projectSubgraphData,
  _primaryTerminalAddress,
  _token,
}: {
  projectId: number | undefined
  jbControllerContract: any
  jbDirectoryContract: any
  jbTokensContract: any
  projectMetadata?: any
  projectSubgraphData?: any
  _primaryTerminalAddress?: string
  _token?: any
}) {
  const { selectedChain } = useContext(ChainContextV5)

  const [metadata, setMetadata] = useState<any>(projectMetadata)
  const [ruleset, setRuleset] = useState<any>()
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
    abi: JBV4TokenABI,
  })

  //Metadata and Ruleset
  useEffect(() => {
    async function getProjectMetadata() {
      const metadataURI: any = await readContract({
        contract: jbControllerContract,
        method: 'uriOf' as string,
        params: [projectId],
      })
      const res = await fetch(metadataURI)
      const data = await res.json()
      setMetadata(data)
    }

    async function getProjectRuleset() {
      const rs: any = await readContract({
        contract: jbControllerContract,
        method: 'currentRulesetOf' as string,
        params: [projectId],
      })
      setRuleset(rs)
    }

    if (jbControllerContract && !projectMetadata && projectId !== undefined)
      getProjectMetadata()
    if (jbControllerContract && projectId) getProjectRuleset()
  }, [jbControllerContract, projectId, projectMetadata])

  //Token Address
  useEffect(() => {
    async function getProjectToken() {
      const token: any = await readContract({
        contract: jbTokensContract,
        method: 'tokenOf' as string,
        params: [projectId],
      })
      setToken((prev: any) => ({ ...prev, tokenAddress: token }))
    }

    if (jbTokensContract && projectId) getProjectToken()
  }, [projectId, jbTokensContract])

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
      let primaryTerminal: string = ZERO_ADDRESS

      while (primaryTerminal === ZERO_ADDRESS || !primaryTerminal) {
        try {
          const primaryTerminal: any = await readContract({
            contract: jbDirectoryContract,
            method: 'primaryTerminalOf' as string,
            params: [projectId, JB_NATIVE_TOKEN_ADDRESS],
          })

          if (primaryTerminal !== ZERO_ADDRESS && primaryTerminal) {
            setPrimaryTerminalAddress(primaryTerminal)
            return // Successfully got a valid terminal address
          } else {
            console.warn(
              `Retrieved zero or invalid address for project ${projectId}, retrying...`
            )
          }
        } catch (error) {
          console.error(
            `Error getting primary terminal for project ${projectId}:`,
            error
          )
        }
      }

      // If we've exhausted all retries and still don't have a valid address
      if (primaryTerminal === ZERO_ADDRESS || !primaryTerminal) {
        console.error(
          `Failed to get valid primary terminal for project ${projectId} after multiple attempts`
        )
      }

      setPrimaryTerminalAddress(primaryTerminal)
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
