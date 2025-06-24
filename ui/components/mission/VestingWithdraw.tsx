import { useContext, useEffect, useState } from 'react'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import VestingABI from 'const/abis/Vesting.json'
import {
  MISSION_CREATOR_ADDRESSES,
  ZERO_ADDRESS,
} from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useActiveAccount } from 'thirdweb/react'
import { readContract, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
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
    abi: MissionCreatorABI as any,
    chain: selectedChain,
  })

  const [vestingAddress, setVestingAddress] = useState<string>()
  // Determine which vesting contract belongs to the connected account
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

      const teamVesting = await getContract({
        client,
        chain: selectedChain,
        address: String(teamAddr),
        abi: VestingABI as any,
      })
      const daoVesting = await getContract({
        client,
        chain: selectedChain,
        address: String(daoAddr),
        abi: VestingABI as any,
      })



    }
    fetchVestingAddress()
  }, [missionCreatorContract, address, missionId, selectedChain])

  if (!hasToken) return null

  return (
    <>
    {teamAddress && <VestingCard address={teamAddress} chain={selectedChain} isTeam={true} tokenSymbol={token?.tokenSymbol || ''} />}
    {daoAddress && <VestingCard address={daoAddress} chain={selectedChain} tokenSymbol={token?.tokenSymbol || ''} />}
    </>
  )
}
