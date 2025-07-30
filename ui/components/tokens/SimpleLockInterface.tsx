import { useState, useEffect, useMemo, useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { BigNumber, ethers } from 'ethers'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { approveToken } from '@/lib/tokens/approve'
import { calculateVMOONEY, createLock, increaseLock } from '@/lib/tokens/ve-token'
import { bigNumberToDate, dateOut, dateToReadable } from '@/lib/utils/dates'
import { NumberType, transformNumber, formatNumberWithCommas } from '@/lib/utils/numbers'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import Balance from '@/components/Balance'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { AllowanceWarning } from '@/components/thirdweb/AllowanceWarning'
import ERC20ABI from '../../const/abis/ERC20.json'
import VotingEscrowABI from '../../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../../const/config'

export default function SimpleLockInterface() {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const [refresh, setRefresh] = useState(false)

  // Helper function to format MOONEY amounts as whole numbers
  const formatMooneyAmount = (amount: any): string => {
    try {
      if (!amount) return '0'
      return Math.round(parseFloat(ethers.utils.formatEther(amount))).toString()
    } catch (error) {
      console.warn('Error formatting MOONEY amount:', error)
      return '0'
    }
  }

  const mooneyContract = useContract({
    address: MOONEY_ADDRESSES[chainSlug],
    abi: ERC20ABI,
    chain: selectedChain,
  })

  const vMooneyContract: any = useContract({
    address: VMOONEY_ADDRESSES[chainSlug],
    abi: VotingEscrowABI,
    chain: selectedChain,
  })

  const { data: MOONEYBalance, isLoading: MOONEYBalanceLoading } = useRead({
    contract: mooneyContract,
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

  const { data: tokenAllowance } = useRead({
    contract: mooneyContract,
    method: 'allowance',
    params: [address, VMOONEY_ADDRESSES[chainSlug]],
    deps: [refresh],
  })

  const [lockAmount, setLockAmount] = useState<string>('')
  const [lockAmountDisplay, setLockAmountDisplay] = useState<string>('')
  const [wantsToIncrease, setWantsToIncrease] = useState(false)

  // Helper functions for comma formatting
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '')
  }

  const formatForDisplay = (value: string): string => {
    if (!value || value === '') return ''
    const cleanValue = removeCommas(value)
    if (cleanValue.includes('.')) {
      const [integerPart, decimalPart] = cleanValue.split('.')
      return formatNumberWithCommas(integerPart) + '.' + decimalPart
    }
    return formatNumberWithCommas(cleanValue)
  }

  // Update display whenever lockAmount changes
  useEffect(() => {
    setLockAmountDisplay(formatForDisplay(lockAmount))
  }, [lockAmount])

  // Check if user has an existing lock
  const hasLock = useMemo(() => {
    if (!VMOONEYLock || !VMOONEYLock[0] || !VMOONEYLock[1]) return false
    try {
      return (
        BigNumber.from(VMOONEYLock[0]).gt(0) &&
        BigNumber.from(VMOONEYLock[1]).gt(Date.now() / 1000)
      )
    } catch (error) {
      console.warn('Error checking lock status:', error)
      return false
    }
  }, [VMOONEYLock])

  // Lock time configuration
  const minMaxLockTime = useMemo(() => {
    try {
      const minTime = dateOut(new Date(), { days: 7 })
      const maxTime = dateOut(new Date(), { years: 4 })
      return {
        min: dateToReadable(minTime),
        max: dateToReadable(maxTime),
      }
    } catch (error) {
      console.warn('Error calculating lock time:', error)
      return {
        min: '',
        max: '',
      }
    }
  }, [])

  const [lockTime, setLockTime] = useState<any>({
    formatted: minMaxLockTime.max,
    value: minMaxLockTime.max ? ethers.BigNumber.from(Date.parse(minMaxLockTime.max)) : ethers.BigNumber.from(0),
    orig: hasLock && VMOONEYLock && VMOONEYLock[1]
      ? {
          formatted: dateToReadable(bigNumberToDate(BigNumber.from(VMOONEYLock[1]))),
          value: BigNumber.from(VMOONEYLock[1]),
        }
      : undefined,
  })

  // Check what can be increased
  const canIncrease = useMemo(() => {
    const amount = lockAmount && parseFloat(lockAmount) > 0
    const time = hasLock && lockTime?.orig
      ? Date.parse(lockTime.formatted) > Date.parse(lockTime.orig.formatted)
      : Date.parse(lockTime.formatted) > Date.now()
    
    return { amount, time }
  }, [lockAmount, lockTime, hasLock])

  // Early return if no chain or addresses configured
  if (!selectedChain || !chainSlug || !MOONEY_ADDRESSES[chainSlug] || !VMOONEY_ADDRESSES[chainSlug]) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-white mb-2">
            Network Not Supported
          </h3>
          <p className="text-gray-300 text-sm">
            Please switch to a supported network to lock MOONEY tokens.
          </p>
        </div>
      </div>
    )
  }

  // If no wallet connected, show connect wallet message
  if (!address) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-white mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-gray-300 text-sm">
            Connect your wallet to lock MOONEY tokens and earn voting power.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
      {/* Compact Header */}
      <div className="p-3 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Lock MOONEY
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Earn voting power
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-gray-400 text-xs">Available</p>
                <div className="text-white text-lg font-RobotoMono font-semibold flex items-center gap-2">
                  <div className="text-white">
                    <Balance
                      balance={MOONEYBalance?.toString() / 1e18}
                      loading={MOONEYBalanceLoading}
                      decimals={0}
                    />
                  </div>
                  <Image
                    src="/coins/MOONEY.png"
                    width={20}
                    height={20}
                    alt="MOONEY"
                    className="rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lock Configuration */}
        <div className="p-6 space-y-6">
          {/* Amount Input */}
          <div className="space-y-3">
            <label className="text-gray-300 text-sm font-medium">
              Amount
            </label>
            <div className="bg-black/30 rounded-xl p-4 border border-white/10 focus-within:border-blue-400/50 transition-colors">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder="0"
                  className="text-white bg-transparent text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none flex-1"
                  value={lockAmountDisplay || ''}
                  disabled={
                    (!MOONEYBalance || +MOONEYBalance.toString() === 0) && !hasLock
                  }
                  onChange={(e: any) => {
                    let value = e.target.value
                    // Remove commas for processing
                    const cleanValue = removeCommas(value)
                    
                    // Allow only numbers and decimal point
                    if (!/^\d*\.?\d*$/.test(cleanValue)) return
                    
                    // Prevent negative values
                    if (parseFloat(cleanValue) < 0) {
                      return
                    }
                    
                    // Remove leading zero if user types a number after it
                    let processedValue = cleanValue
                    if (
                      processedValue.startsWith('0') &&
                      processedValue.length > 1 &&
                      processedValue[1] !== '.'
                    ) {
                      processedValue = processedValue.substring(1)
                    }
                    
                    // Update the clean value for logic and let useEffect handle display formatting
                    setLockAmount(processedValue)
                  }}
                />
                <button
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium ml-2 px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  onClick={() => {
                    if (MOONEYBalance) {
                      const maxAmount = parseFloat(ethers.utils.formatEther(MOONEYBalance))
                      setLockAmount(maxAmount.toString())
                    }
                  }}
                  disabled={!MOONEYBalance || +MOONEYBalance.toString() === 0}
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          {/* Lock Duration */}
          <div className="space-y-3">
            <label className="text-gray-300 text-sm font-medium">
              Lock Duration
            </label>
            <div className="bg-black/30 rounded-xl p-4 border border-white/10 focus-within:border-blue-400/50 transition-colors">
              <input
                type="date"
                className="text-white bg-transparent text-lg font-RobotoMono focus:outline-none w-full"
                value={lockTime?.formatted || ''}
                min={
                  hasLock && VMOONEYLock && VMOONEYLock[1]
                    ? dateToReadable(
                        dateOut(bigNumberToDate(BigNumber.from(VMOONEYLock[1])), { days: 1 })
                      )
                    : minMaxLockTime.min || dateToReadable(dateOut(new Date(), { days: 7 }))
                }
                max={minMaxLockTime.max || dateToReadable(dateOut(new Date(), { years: 4 }))}
                disabled={
                  (!MOONEYBalance || +MOONEYBalance.toString() === 0) && !hasLock
                }
                onChange={(e: any) => {
                  const inputValue = e.target.value

                  // Update state immediately without validation during typing
                  setLockTime({
                    ...lockTime,
                    formatted: inputValue
                      ? inputValue
                      : lockTime.orig?.formatted,
                    value: inputValue
                      ? ethers.BigNumber.from(
                          Date.parse(inputValue)
                        )
                      : lockTime.orig?.value,
                  })
                  setWantsToIncrease(!!inputValue)
                }}
                onBlur={(e: any) => {
                  const inputValue = e.target.value

                  // Only validate when user finishes editing (loses focus)
                  if (inputValue && inputValue.length === 10) {
                    const selectedDate = new Date(inputValue)
                    const minDate = dateOut(new Date(), { days: 7 })

                    if (selectedDate < minDate) {
                      toast.error(
                        'Lock period must be at least 7 days in the future'
                      )
                      // Reset to minimum valid date
                      const validDate = dateToReadable(minDate)
                      setLockTime({
                        ...lockTime,
                        formatted: validDate,
                        value: ethers.BigNumber.from(
                          Date.parse(validDate)
                        ),
                      })
                    }
                  }
                }}
              />
            </div>
            <p className="text-gray-400 text-xs">
              Minimum lock period: 7 days • Maximum: 4 years
            </p>
          </div>

          {/* Voting Power Preview */}
          {(canIncrease.time || canIncrease.amount) &&
            wantsToIncrease && (
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-400/20 space-y-3">
                <p className="text-gray-300 text-xs">
                  Locking MOONEY gives you vMOONEY tokens. Your voting power is calculated as the square root of your vMOONEY balance.
                </p>

                {/* vMOONEY Amount */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">
                    vMOONEY Received
                  </span>
                  <div className="text-right min-w-0 flex-shrink-0">
                    <span className="text-white text-xl font-RobotoMono">
                      {(() => {
                        try {
                          return (calculateVMOONEY as any)({
                            MOONEYAmount:
                              +lockAmount ||
                              parseFloat(formatMooneyAmount(
                                VMOONEYLock?.[0] || 0
                              )),
                            VMOONEYAmount: 0,
                            time: Date.parse(lockTime.formatted),
                            lockTime: Date.parse(
                              hasLock && lockTime?.orig
                                ? lockTime.orig.formatted
                                : new Date()
                            ),
                            max: Date.parse(minMaxLockTime.max),
                          })
                        } catch (error) {
                          console.warn('Error calculating vMOONEY:', error)
                          return '0.00'
                        }
                      })()}
                    </span>
                  </div>
                </div>

                {/* Voting Power */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">
                    Voting Power
                  </span>
                  <div className="text-right min-w-0 flex-shrink-0">
                    <span className="text-green-400 text-xl font-RobotoMono">
                      {(() => {
                        try {
                          const vMooneyAmount = (calculateVMOONEY as any)({
                            MOONEYAmount:
                              +lockAmount ||
                              parseFloat(formatMooneyAmount(
                                VMOONEYLock?.[0] || 0
                              )),
                            VMOONEYAmount: 0,
                            time: Date.parse(lockTime.formatted),
                            lockTime: Date.parse(
                              hasLock && lockTime?.orig
                                ? lockTime.orig.formatted
                                : new Date()
                            ),
                            max: Date.parse(minMaxLockTime.max),
                          })
                          return Math.sqrt(parseFloat(vMooneyAmount || 0)).toFixed(2)
                        } catch (error) {
                          console.warn('Error calculating voting power:', error)
                          return '0.00'
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Lock/Increase Button */}
          <PrivyWeb3Button
            v5
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-4 px-8 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
            label={
              hasLock
                ? canIncrease.amount && canIncrease.time
                  ? 'Increase Amount & Extend Lock'
                  : canIncrease.amount
                  ? 'Increase Amount'
                  : canIncrease.time
                  ? 'Extend Lock'
                  : 'Update Lock'
                : 'Create Lock'
            }
            action={async () => {
              if (!account) throw new Error('No account connected')
              try {
                const lockReceipt = hasLock
                  ? await increaseLock({
                      account,
                      votingEscrowContract: vMooneyContract,
                      newAmount: lockAmount && ethers.utils.parseEther(lockAmount),
                      currentTime: lockTime?.orig?.value,
                      newTime: lockTime?.value.div(1000),
                    })
                  : await createLock({
                      account,
                      votingEscrowContract: vMooneyContract,
                      amount: lockAmount && ethers.utils.parseEther(lockAmount),
                      time: lockTime?.value.div(1000),
                    })

                if (lockReceipt) {
                  toast.success(
                    hasLock
                      ? 'Lock increased successfully!'
                      : 'Lock created successfully!'
                  )
                  setRefresh((prev) => !prev)
                }
              } catch (error) {
                throw error
              }
            }}
            isDisabled={
              // For new locks, require both amount and time
              !hasLock ? (!lockAmount || lockAmount === '' || lockAmount === '0' || !canIncrease.time) :
              // For existing locks, allow if either amount or time can be increased
              (!canIncrease.amount && !canIncrease.time)
            }
          />

          {/* Allowance Warning */}
          <div className="mt-4">
            <AllowanceWarning
              tokenContract={mooneyContract}
              spender={VMOONEY_ADDRESSES[chainSlug]}
              tokenAllowance={tokenAllowance}
            />
          </div>
        </div>
      </div>
  )
}
