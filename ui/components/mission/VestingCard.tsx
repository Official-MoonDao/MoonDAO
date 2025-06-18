import { useEffect, useState } from 'react'
import VestingABI from 'const/abis/Vesting.json'
import { prepareContractCall, readContract, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import StandardButton from '@/components/layout/StandardButton'
import toast from 'react-hot-toast'
import client from '@/lib/thirdweb/client'

export default function VestingCard({
  address,
  chain,
  tokenSymbol,
}: {
  address: string
  chain: any
  tokenSymbol: string
}) {
  const account = useActiveAccount()
  const [vestingContract, setVestingContract] = useState<any>()
  const [withdrawable, setWithdrawable] = useState<string>('0')
  const [total, setTotal] = useState<string>('0')

  useEffect(() => {
    async function fetchData() {
      if (!address) return
      const vc = await getContract({
        client,
        chain,
        address: String(address),
        abi: VestingABI as any,
      })
      const [vested, withdrawn, totalReceived] = await Promise.all([
        readContract({ contract: vc, method: 'vestedAmount' as string, params: [] }),
        readContract({ contract: vc, method: 'totalWithdrawn' as string, params: [] }),
        readContract({ contract: vc, method: 'totalReceived' as string, params: [] }),
      ])
      const available = BigInt(String(vested)) - BigInt(String(withdrawn))
      setWithdrawable((Number(available) / 1e18).toFixed(4))
      setTotal((Number(totalReceived) / 1e18).toFixed(4))
      setVestingContract(vc)
    }
    fetchData()
  }, [address, chain])

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

  if (!vestingContract) return null

  return (
    <div className="flex flex-col gap-2 bg-dark-cool p-4 rounded-lg">
      <p className="font-bold">Withdrawable</p>
      <p>
        {withdrawable} {tokenSymbol}
      </p>
      <p className="font-bold">Total Vesting</p>
      <p>{total}</p>
      <StandardButton className="gradient-2 rounded-full mt-2 w-fit" onClick={handleWithdraw}>
        Withdraw
      </StandardButton>
    </div>
  )
}
