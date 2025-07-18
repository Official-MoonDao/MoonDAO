import MissionCreatorABI from 'const/abis/MissionCreator.json'
import { MISSION_CREATOR_ADDRESSES } from 'const/config'
import { useContext } from 'react'
import { getChainSlug } from '../thirdweb/chain'
import ChainContextV5 from '../thirdweb/chain-context-v5'
import useContract from '../thirdweb/hooks/useContract'
import useRead from '../thirdweb/hooks/useRead'

export default function useMissionFundingStage(missionId: number | undefined) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreatorABI.abi,
    chain: selectedChain,
  })

  const { data: currentStage } = useRead({
    contract: missionCreatorContract,
    method: 'stage',
    params: [missionId],
    deps: [missionId],
  })

  return currentStage ? +currentStage.toString() : undefined
}
