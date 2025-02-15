//Juicebox V4
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { projectQuery } from './subgraph'

export default function useJBProjectData(
  projectId: number | undefined,
  jbControllerContract: any,
  jbTokensContract: any,
  projectMetadata?: any,
  projectSubgraphData?: any
) {
  const [metadata, setMetadata] = useState<any>(projectMetadata)
  const [ruleset, setRuleset] = useState<any>()
  const [rulesetMetadata, setRulesetMetadata] = useState<any>()
  const [tokenAddress, setTokenAddress] = useState<any>()
  const [subgraphData, setSubgraphData] = useState<any>(projectSubgraphData)

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
      const [rs, rsMetadata]: any = await readContract({
        contract: jbControllerContract,
        method: 'currentRulesetOf' as string,
        params: [projectId],
      })
      setRuleset(rs)
      setRulesetMetadata(rsMetadata)
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
      setTokenAddress(token)
    }

    if (jbTokensContract && projectId) getProjectToken()
  }, [projectId, jbTokensContract])

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
        console.log(res)
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
    rulesetMetadata,
    tokenAddress,
    subgraphData,
  }
}
