//Juicebox V4
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'

export default function useJBProjectData(
  projectId: number,
  jbControllerContract: any,
  jbTokensContract: any,
  projectMetadata?: any
) {
  const [metadata, setMetadata] = useState<any>(projectMetadata)
  const [ruleset, setRuleset] = useState<any>()
  const [rulesetMetadata, setRulesetMetadata] = useState<any>()
  const [tokenAddress, setTokenAddress] = useState<any>()

  //Metadata
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

    if (jbControllerContract && !projectMetadata) getProjectMetadata()
  }, [jbControllerContract, projectId, projectMetadata])

  //Ruleset and Token
  useEffect(() => {
    async function getProjectRuleset() {
      const [rs, rsMetadata]: any = await readContract({
        contract: jbControllerContract,
        method: 'currentRulesetOf' as string,
        params: [projectId],
      })
      setRuleset(rs)
      setRulesetMetadata(rsMetadata)
    }

    async function getProjectToken() {
      const token: any = await readContract({
        contract: jbTokensContract,
        method: 'tokenOf' as string,
        params: [projectId],
      })
      setTokenAddress(token)
    }

    if (jbControllerContract) getProjectRuleset()
    if (jbTokensContract) getProjectToken()
  }, [projectId, jbControllerContract, jbTokensContract])

  return {
    metadata,
    ruleset,
    rulesetMetadata,
    tokenAddress,
  }
}
