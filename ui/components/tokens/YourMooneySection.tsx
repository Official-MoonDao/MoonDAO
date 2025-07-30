import { useContext, useState, useMemo } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { BigNumber, ethers } from 'ethers'
import toast from 'react-hot-toast'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { LockData } from '@/components/lock/LockData'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { increaseLock } from '@/lib/tokens/ve-token'
import { bigNumberToDate, dateOut, dateToReadable } from '@/lib/utils/dates'
import VotingEscrowABI from '../../const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES } from '../../const/config'

export default function YourMooneySection() {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [refresh, setRefresh] = useState(false)

  // Early return if no chain or addresses configured
  if (!selectedChain || !chainSlug || !VMOONEY_ADDRESSES[chainSlug]) {
    return (
      <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-8 border border-white/10 text-center">
        <h3 className="text-xl font-bold text-white mb-4">
          Network Not Supported
        </h3>
        <p className="text-gray-300">
          Please switch to a supported network to view your MOONEY information.
        </p>
      </div>
    )
  }

  const vMooneyContract: any = useContract({
    address: VMOONEY_ADDRESSES[chainSlug],
    abi: VotingEscrowABI,
    chain: selectedChain,
  })

  const { data: VMOONEYBalance, isLoading: VMOONEYBalanceLoading } = useRead({
    contract: vMooneyContract,
    method: 'balanceOf',
    params: [address],
    deps: [refresh],
  })

  const { data: VMOONEYLock, isLoading: VMOONEYLockLoading } = useRead({
    contract: vMooneyContract,
    method: 'locked',
    params: [address],
    deps: [refresh],
  })

  // Check if user has an existing lock
  const hasLock = VMOONEYLock && 
    VMOONEYLock[0] && 
    parseInt(VMOONEYLock[0].toString()) > 0 &&
    VMOONEYLock[1] && 
    parseInt(VMOONEYLock[1].toString()) > Date.now() / 1000

  // Extend lock functionality
  const [extendTime, setExtendTime] = useState<string>('')

  // Calculate max extension time (4 years from now)
  const maxExtendTime = useMemo(() => {
    try {
      const maxTime = dateOut(new Date(), { years: 4 })
      return dateToReadable(maxTime)
    } catch (error) {
      console.warn('Error calculating max extend time:', error)
      return ''
    }
  }, [])

  // Current lock expiry
  const currentLockExpiry = useMemo(() => {
    try {
      if (VMOONEYLock && VMOONEYLock[1]) {
        return dateToReadable(bigNumberToDate(BigNumber.from(VMOONEYLock[1])))
      }
      return ''
    } catch (error) {
      console.warn('Error calculating current lock expiry:', error)
      return ''
    }
  }, [VMOONEYLock])

  if (!address) {
    return (
      <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-8 border border-white/10 text-center">
        <h3 className="text-xl font-bold text-white mb-4">
          Connect Your Wallet
        </h3>
        <p className="text-gray-300">
          Connect your wallet to view your MOONEY lock information and claim rewards.
        </p>
      </div>
    )
  }

  if (!hasLock) {
    return (
      <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-8 border border-white/10 text-center">
        <h3 className="text-xl font-bold text-white mb-4">
          No Lock Found
        </h3>
        <p className="text-gray-300">
          You don't have any locked MOONEY tokens yet. Lock MOONEY above to start earning voting power and rewards.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Lock Overview */}
      <LockData
        hasLock={hasLock}
        VMOONEYBalance={VMOONEYBalance}
        VMOONEYBalanceLoading={VMOONEYBalanceLoading}
        VMOONEYLock={VMOONEYLock}
        VMOONEYLockLoading={VMOONEYLockLoading}
      />

      {/* Extend Lock Section */}
      <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          🚀 Extend Your Lock
        </h3>
        <p className="text-gray-300 text-sm mb-4">
          Extend your lock period to maintain and increase your voting power. Current lock expires on {currentLockExpiry}.
        </p>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">
              New Expiry Date
            </label>
            <div className="bg-black/30 rounded-xl p-3 border border-white/10 focus-within:border-purple-400/50 transition-colors">
              <input
                type="date"
                className="text-white bg-transparent text-lg font-RobotoMono focus:outline-none w-full"
                value={extendTime}
                min={VMOONEYLock?.[1] ? dateToReadable(dateOut(bigNumberToDate(BigNumber.from(VMOONEYLock[1])), { days: 1 })) : dateToReadable(dateOut(new Date(), { days: 1 }))}
                max={maxExtendTime || dateToReadable(dateOut(new Date(), { years: 4 }))}
                onChange={(e) => setExtendTime(e.target.value)}
              />
            </div>
            <p className="text-gray-400 text-xs">
              Must be later than current expiry • Maximum: 4 years from now
            </p>
          </div>

          <PrivyWeb3Button
            v5
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
            label="Extend Lock Period"
            action={async () => {
              if (!account) throw new Error('No account connected')
              if (!extendTime) throw new Error('Please select an extension date')
              
              try {
                const newTimeValue = ethers.BigNumber.from(Date.parse(extendTime))
                const currentTimeValue = BigNumber.from(VMOONEYLock[1])
                
                const receipt = await increaseLock({
                  account,
                  votingEscrowContract: vMooneyContract,
                  newAmount: ethers.BigNumber.from(0), // No amount increase
                  currentTime: currentTimeValue,
                  newTime: newTimeValue.div(1000),
                })

                if (receipt) {
                  toast.success('Lock period extended successfully!')
                  setRefresh((prev) => !prev)
                  setExtendTime('')
                }
              } catch (error) {
                toast.error('Failed to extend lock period.')
                throw error
              }
            }}
            isDisabled={
              !extendTime || 
              !VMOONEYLock || 
              Date.parse(extendTime) <= parseInt(VMOONEYLock[1].toString()) * 1000
            }
          />
        </div>
      </div>
    </div>
  )
}
