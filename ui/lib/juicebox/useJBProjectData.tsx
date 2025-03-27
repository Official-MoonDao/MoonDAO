//Juicebox V4
import JBV4TokenABI from 'const/abis/JBV4Token.json'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import useContract from '../thirdweb/hooks/useContract'
import { projectQuery } from './subgraph'

export default function useJBProjectData(
  projectId: number | undefined,
  jbControllerContract: any,
  jbTokensContract: any,
  projectMetadata?: any,
  projectSubgraphData?: any
) {
  const { selectedChain } = useContext(ChainContextV5)

  const [metadata, setMetadata] = useState<any>(projectMetadata)
  const [ruleset, setRuleset] = useState<any>()
  const [token, setToken] = useState<any>({
    tokenAddress: '',
    tokenName: '',
    tokenSymbol: '',
    tokenSupply: '',
    reservedTokens: '',
    reservedRate: '',
  })
  const [subgraphData, setSubgraphData] = useState<any>(projectSubgraphData)

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

    if (jbControllerContract && !projectMetadata && projectId)
      getProjectMetadata()
    if (jbControllerContract && projectId) getProjectRuleset()
  }, [jbControllerContract, projectId, projectMetadata])

  //Token
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

  //Project Subgraph Data
  useEffect(() => {
    async function getSubgraphData() {
      if (!projectId) return
      try {
        const res = await fetch(
          '/api/juicebox/query?query=' + projectQuery(projectId),
          {
            method: 'POST',
          }
        )
        const data = await res.json()
        const projectSubgraphData = data.projects?.[0]
        setSubgraphData(projectSubgraphData)
      } catch (error) {
        console.error(error)
      }
    }

    if (projectId) getSubgraphData()
  }, [projectId])

  return {
    metadata,
    ruleset,
    token,
    subgraphData,
  }
}
