import MissionCreatorABI from 'const/abis/MissionCreator.json'
import { MISSION_CREATOR_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { getChainSlug } from '../thirdweb/chain'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import useContract from '../thirdweb/hooks/useContract'

export default function useMissionFundingStage(missionId: number | undefined) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [currentStage, setCurrentStage] = useState<number>()

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreatorABI,
    chain: selectedChain,
  })

  useEffect(() => {
    async function getCurrentStage() {
      const stage: any = await readContract({
        contract: missionCreatorContract,
        method: 'stage' as string,
        params: [missionId],
      })
      setCurrentStage(+stage.toString())
    }
    if (missionCreatorContract && missionId !== undefined) {
      getCurrentStage()
    }
  }, [missionCreatorContract, missionId])

  return currentStage
}
