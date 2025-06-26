import VestingABI from 'const/abis/Vesting.json'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function VestingCard({
  address,
  chain,
  tokenSymbol,
  isTeam = false,
}: {
  address: string
  chain: any
  tokenSymbol: string
  isTeam?: boolean
}) {
  const account = useActiveAccount()
  const vestingContract = useContract({
    chain,
    address: String(address),
    abi: VestingABI as any,
  })
  const [withdrawable, setWithdrawable] = useState<string>('0')
  const [total, setTotal] = useState<string>('0')

  useEffect(() => {
    async function fetchData() {
      if (!address || !vestingContract) return
      const [vested, withdrawn, totalReceived, beneficiary] = await Promise.all(
        [
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
          readContract({
            contract: vestingContract,
            method: 'totalReceived' as string,
            params: [],
          }),
          readContract({
            contract: vestingContract,
            method: 'beneficiary' as string,
            params: [],
          }),
        ]
      )
      const available = BigInt(String(vested)) - BigInt(String(withdrawn))
      setWithdrawable((Number(available) / 1e18).toFixed(10))
      setTotal((Number(totalReceived) / 1e18).toFixed(4))
    }
    fetchData()
  }, [address, chain, vestingContract])

  const handleWithdraw = async () => {
    if (!vestingContract || !account) return
    try {
      const tx = prepareContractCall({
        contract: vestingContract,
        method: 'withdraw' as string,
        params: [],
      })
      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Withdrawal successful!')
    } catch (error) {
      console.error(error)
      toast.error('Withdrawal failed.')
    }
  }

  return (
    <div className="flex flex-col gap-2 bg-dark-cool p-4 rounded-lg">
      <h2 className="text-lg">{isTeam ? 'Team ' : 'MoonDAO '} Vesting</h2>
      <p className="font-bold text-sm">Withdrawable</p>
      <p>
        {withdrawable} {tokenSymbol}
      </p>
      <p className="font-bold text-sm">Total Vesting</p>
      <p>
        {total} {tokenSymbol}
      </p>
      <PrivyWeb3Button
        action={handleWithdraw}
        label="Withdraw"
        className="gradient-2 rounded-full mt-2 w-fit"
        isDisabled={!vestingContract || Number(withdrawable) === 0}
        onSuccess={() => {
          // Refresh data after successful withdrawal
          setWithdrawable('0')
        }}
      />
    </div>
  )
}