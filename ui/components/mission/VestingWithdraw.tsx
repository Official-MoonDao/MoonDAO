import MissionCreator from 'const/abis/MissionCreator.json'
import { MISSION_CREATOR_ADDRESSES, ZERO_ADDRESS } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import VestingCard from './VestingCard'

export default function VestingWithdraw({
  missionId,
  token,
}: {
  missionId: number
  token?: {
    tokenAddress: string
    tokenSymbol: string
  }
}) {
  const hasToken = token?.tokenAddress && token.tokenAddress !== ZERO_ADDRESS
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [teamAddress, setTeamAddress] = useState<string>()
  const [daoAddress, setDaoAddress] = useState<string>()

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreator.abi as any,
    chain: selectedChain,
  })

  // Determine which vesting contracts belong to the mission
  useEffect(() => {
    async function fetchVestingAddress() {
      if (!missionCreatorContract || !address) return

      const [teamAddr, daoAddr] = await Promise.all([
        readContract({
          contract: missionCreatorContract,
          method: 'missionIdToTeamVesting' as string,
          params: [missionId],
        }),
        readContract({
          contract: missionCreatorContract,
          method: 'missionIdToMoonDAOVesting' as string,
          params: [missionId],
        }),
      ])
      if (!teamAddr || !daoAddr) return
      setTeamAddress(String(teamAddr))
      setDaoAddress(String(daoAddr))
    }
    fetchVestingAddress()
  }, [missionCreatorContract, address, missionId, selectedChain])

  if (!hasToken) return null

  return (
    <>
      {teamAddress && (
        <VestingCard
          address={teamAddress}
          chain={selectedChain}
          isTeam={true}
          tokenSymbol={token?.tokenSymbol || ''}
        />
      )}
      {daoAddress && (
        <VestingCard
          address={daoAddress}
          chain={selectedChain}
          tokenSymbol={token?.tokenSymbol || ''}
        />
      )}
    </>
  )
}
