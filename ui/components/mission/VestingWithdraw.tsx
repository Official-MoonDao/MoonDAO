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
}: {
  missionId: number
}) {
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreatorABI as any,
    chain: selectedChain,
  })

  const [vestingAddress, setVestingAddress] = useState<string>()
  const [tokenSymbol, setTokenSymbol] = useState<string>('')
  const [withdrawable, setWithdrawable] = useState<string>('0')
  const [vestingContract, setVestingContract] = useState<any>()

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
      const candidates = [teamAddr as string, daoAddr as string]
      for (const addr of candidates) {
        const vc = getContract({
          client,
          chain: selectedChain,
          address: addr,
          abi: VestingABI as any,
        })
        const beneficiary: any = await readContract({
          contract: vc,
          method: 'beneficiary' as string,
          params: [],
        })
        if (
          beneficiary &&
          address?.toLowerCase() === (beneficiary as string).toLowerCase()
        ) {
          setVestingAddress(addr)
          setVestingContract(vc)
          break
        }
      }
    }
    fetchVestingAddress()
  }, [missionCreatorContract, address, missionId, selectedChain])

  // Fetch withdrawable amount and token info
  useEffect(() => {
    async function fetchData() {
      if (!vestingContract) return
      const [vested, withdrawn] = await Promise.all([
        readContract({
          contract: vestingContract,
          method: 'vestedAmount' as string,
          params: [],
        }),
        readContract({
          contract: vestingContract,
          method: 'totalWithdrawn' as string,
          params: [],
        }),
      ])
      const available = BigInt(vested as bigint) - BigInt(withdrawn as bigint)
      setWithdrawable((Number(available) / 1e18).toFixed(4))

      const tokenAddr: any = await readContract({
        contract: vestingContract,
        method: 'token' as string,
        params: [],
      })
      if (tokenAddr && tokenAddr !== ZERO_ADDRESS) {
        const tokenContract = getContract({
          client,
          chain: selectedChain,
          address: tokenAddr,
          abi: ERC20,
        })
        try {
          const symbol: any = await readContract({
            contract: tokenContract,
            method: 'symbol' as string,
            params: [],
          })
          setTokenSymbol(symbol)
        } catch (err) {
          console.error(err)
        }
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [vestingContract, selectedChain])

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

  return (
    <div className="flex flex-col gap-2 bg-dark-cool p-4 rounded-lg">
      <p className="font-bold">Withdrawable</p>
      <p>
        {withdrawable} {tokenSymbol}
      </p>
      <StandardButton
        className="gradient-2 rounded-full mt-2 w-fit"
        onClick={handleWithdraw}
      >
        Withdraw
      </StandardButton>
    </div>
  )
}
