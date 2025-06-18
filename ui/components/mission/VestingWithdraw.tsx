import { useContext, useEffect, useState } from 'react'
import MissionCreatorABI from 'const/abis/MissionCreator.json'
import VestingABI from 'const/abis/Vesting.json'
import ERC20 from 'const/abis/ERC20.json'
import {
  MISSION_CREATOR_ADDRESSES,
  ZERO_ADDRESS,
} from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useActiveAccount } from 'thirdweb/react'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
  getContract,
} from 'thirdweb'
import StandardButton from '@/components/layout/StandardButton'
import toast from 'react-hot-toast'
import client from '@/lib/thirdweb/client'


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
  const hasToken = token?.tokenAddress !== ZERO_ADDRESS
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreatorABI as any,
    chain: selectedChain,
  })

  const [withdrawable, setWithdrawable] = useState<string>('0')
  const [total, setTotal] = useState<string>('0')
  const [vestingContract, setVestingContract] = useState<any>(null)
  // Determine which vesting contract belongs to the connected account
  useEffect(() => {
    async function fetchVestingAddress() {
      if (!missionCreatorContract || !address) return
      
      const teamAddr = await readContract({
          contract: missionCreatorContract,
          method: 'missionIdToTeamVesting' as string,
          params: [missionId],
        })
      const daoAddr = await readContract({
          contract: missionCreatorContract,
          method: 'missionIdToMoonDAOVesting' as string,
          params: [missionId],
        })
        if (!teamAddr || !daoAddr) return
      const teamVesting: any = await getContract({
        client,
        chain: selectedChain,
        address: String(teamAddr),
        abi: VestingABI as any,
      })
      const teamBeneficiary: any = await readContract({
        contract: teamVesting,
        method: 'beneficiary' as string,
        params: [],
      })
      const daoVesting: any = await getContract({
        client,
        chain: selectedChain,
        address: String(daoAddr),
        abi: VestingABI as any,
      })
      const daoBeneficiary: any = await readContract({
        contract: daoVesting,
        method: 'beneficiary' as string,
        params: [],
      })
      const [teamVested, teamWithdrawn, teamTotal] = await Promise.all([
        readContract({
          contract: teamVesting,
          method: 'vestedAmount' as string,
          params: [],
        }),
        readContract({
          contract: teamVesting,
          method: 'totalWithdrawn' as string,
          params: [],
        }),
        readContract({
          contract: teamVesting,
          method: 'totalReceived' as string,
          params: [],
        })
      ])
      const [moondaoVested, moondaoWithdrawn, moondaoTotal] = await Promise.all([
        readContract({
          contract: daoVesting,
          method: 'vestedAmount' as string,
          params: [],
        }),
        readContract({
          contract: daoVesting,
          method: 'totalWithdrawn' as string,
          params: [],
        }),
        readContract({
          contract: daoVesting,
          method: 'totalReceived' as string,
          params: [],
        })
      ])
      const available = BigInt(String(teamVested)) - BigInt(String(teamWithdrawn))
      setWithdrawable((Number(available) / 1e18).toFixed(4))
      setTotal((Number(teamTotal) / 1e18).toFixed(4))
      setVestingContract(teamVesting)
      
    }
    fetchVestingAddress()
  }, [missionCreatorContract, address, missionId, selectedChain])


  const handleWithdraw = async () => {
    if (!account || !vestingContract) return
    try {
      const tx = prepareContractCall({
        contract: vestingContract,
        method: 'withdraw' as string,
        params: [],
      })
      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Withdrawal successful')
    } catch (err) {
      console.error('Withdraw error:', err)
      toast.error('Withdrawal failed')
    }
  }
console.log('hasToken', hasToken)
  return (
    <div className="flex flex-col gap-2 bg-dark-cool p-4 rounded-lg">
      {hasToken && (
        <>
          <p className="font-bold">Withdrawable</p>
          <p>
            {withdrawable} {token?.tokenSymbol}
          </p>
          <p className="font-bold">Total Vesting</p>
          <p>
            {total}
          </p>
          <StandardButton
            className="gradient-2 rounded-full mt-2 w-fit"
            onClick={handleWithdraw}
          >
            Withdraw
          </StandardButton>
        </>
        
      )}
    </div>
  )
}
