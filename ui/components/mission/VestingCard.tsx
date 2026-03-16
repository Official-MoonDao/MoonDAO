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

function VestingCardSkeleton({ isTeam = false }: { isTeam?: boolean }) {
  return (
    <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 border border-white/[0.08] rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="h-5 bg-white/[0.06] rounded-lg w-36" />
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05] space-y-2">
          <div className="h-3 bg-white/[0.06] rounded w-20" />
          <div className="h-5 bg-white/[0.06] rounded w-28" />
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05] space-y-2">
          <div className="h-3 bg-white/[0.06] rounded w-20" />
          <div className="h-5 bg-white/[0.06] rounded w-24" />
        </div>
      </div>
      <div className="h-10 bg-white/[0.06] rounded-xl w-28" />
    </div>
  )
}

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
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    async function fetchData() {
      if (!address || !vestingContract) return
      setIsLoading(true)
      try {
        const [vested, withdrawn, totalReceived, beneficiary] =
          await Promise.all([
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
          ])
        const available = BigInt(String(vested)) - BigInt(String(withdrawn))
        setWithdrawable(parseFloat((Number(available) / 1e18).toFixed(6)).toString())
        setTotal(parseFloat((Number(totalReceived) / 1e18).toFixed(4)).toString())
      } catch (error) {
        console.error('Error fetching vesting data:', error)
      } finally {
        setIsLoading(false)
      }
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

  // Show skeleton while loading
  if (isLoading) {
    return <VestingCardSkeleton isTeam={isTeam} />
  }

  return (
    <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 border border-white/[0.08] rounded-2xl p-5 space-y-4">
      {/* Header */}
      <h2 className="text-base font-semibold text-white">
        {isTeam ? 'Team' : 'MoonDAO'} Vesting
      </h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
          <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
            Withdrawable
          </p>
          <p className="text-white font-semibold text-sm truncate">
            {withdrawable}{' '}
            <span className="text-gray-400 font-normal">{tokenSymbol}</span>
          </p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
          <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
            Total Vesting
          </p>
          <p className="text-white font-semibold text-sm truncate">
            {total}{' '}
            <span className="text-gray-400 font-normal">{tokenSymbol}</span>
          </p>
        </div>
      </div>

      {/* Withdraw Button */}
      <PrivyWeb3Button
        action={handleWithdraw}
        label="Withdraw"
        className="gradient-2 rounded-xl py-2 px-5 text-sm font-medium w-fit"
        isDisabled={!vestingContract || Number(withdrawable) === 0}
        onSuccess={() => {
          setWithdrawable('0')
          setIsLoading(true)
        }}
      />
    </div>
  )
}
