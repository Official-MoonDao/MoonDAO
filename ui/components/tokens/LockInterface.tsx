import { useState, useEffect, useMemo, useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { BigNumber, ethers } from 'ethers'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { approveToken } from '@/lib/tokens/approve'
import { calculateVMOONEY, createLock, increaseLock, withdrawLock } from '@/lib/tokens/ve-token'
import { bigNumberToDate, dateOut, dateToReadable } from '@/lib/utils/dates'
import { NumberType, transformNumber, formatNumberWithCommas } from '@/lib/utils/numbers'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import Balance from '@/components/Balance'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { AllowanceWarning } from '@/components/thirdweb/AllowanceWarning'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import WithdrawVMooney from '@/components/tokens/WithdrawVMooney'
import { LockData } from '@/components/lock/LockData'
import ERC20ABI from '../../const/abis/ERC20.json'
import VotingEscrowABI from '../../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../../const/config'

export default function LockInterface() {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const [refresh, setRefresh] = useState(false)

  // Helper function to format MOONEY amounts as whole numbers
  const formatMooneyAmount = (amount: any) => {
    if (!amount) return '0'
    return Math.round(parseFloat(ethers.utils.formatEther(amount))).toString()
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

  const { data: tokenAllowance } = useRead({
    contract: mooneyContract,
    method: 'allowance',
    params: [address, VMOONEY_ADDRESSES[chainSlug]],
    deps: [refresh],
  })

  const [hasExpired, setHasExpired] = useState<boolean>()
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

  const oneWeekOut = dateOut(new Date(), { days: 7 })
  const [lockTime, setLockTime] = useState({
    value: ethers.BigNumber.from(+oneWeekOut),
    formatted: dateToReadable(oneWeekOut),
  } as any)

  const [minMaxLockTime, setMinMaxLockTime] = useState({} as any)
  const [canIncrease, setCanIncrease] = useState({ amount: true, time: true })

  const hasLock = useMemo(() => {
    return (
      selectedChain &&
      address &&
      !VMOONEYLockLoading &&
      VMOONEYLock &&
      VMOONEYLock[0] != 0
    )
  }, [VMOONEYLock, VMOONEYLockLoading, address, selectedChain])

  // Reset lock amount on chain switch
  useEffect(() => {
    setLockAmount('')
    setLockTime({
      value: ethers.BigNumber.from(+oneWeekOut),
      formatted: dateToReadable(oneWeekOut),
    })
  }, [selectedChain])

  // Check if lock has expired
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasExpired(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          ethers.BigNumber.from(+new Date()).gte(
            BigNumber.from(VMOONEYLock[1]).mul(1000)
          )
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address])

  // Current lock setup
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      if (!lockAmount || lockAmount === '' || lockAmount === '0') {
        setLockAmount(formatMooneyAmount(VMOONEYLock[0]))
      }
      const origTime = {
        value: BigNumber.from(VMOONEYLock[1]),
        formatted: dateToReadable(bigNumberToDate(VMOONEYLock[1])),
      }
      if (!lockTime?.orig) {
        setLockTime({
          ...origTime,
          orig: origTime,
        })
      }
    } else {
      setLockTime({
        value: ethers.BigNumber.from(+oneWeekOut),
        formatted: dateToReadable(oneWeekOut),
      })
    }
  }, [hasLock, VMOONEYLock, selectedChain, address])

  // Lock time min/max setup
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      const maxLockTime = dateOut(new Date(), { days: 1461 }) // 4 years from now
      
      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(maxLockTime),
      })
      
      setCanIncrease({
        amount: lockAmount && lockAmount !== '' && lockAmount !== '0' && VMOONEYLock &&
          ethers.utils.parseEther(lockAmount).gt(VMOONEYLock[0]),
        time: 
          lockTime?.value &&
          lockTime.value.gt(BigNumber.from(VMOONEYLock[1]).mul(1000)) && // New time must be greater than current lock end
          lockTime.value.lte(BigNumber.from(+maxLockTime)), // New time must be within 4 years from now
      })
    } else {
      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(dateOut(new Date(), { days: 1461 })),
      })
      setCanIncrease({
        amount: !!(lockAmount && lockAmount !== '' && lockAmount !== '0'),
        time: lockTime?.value && lockTime.value.gt(ethers.BigNumber.from(+oneWeekOut)),
      })
    }
  }, [hasLock, lockAmount, lockTime, VMOONEYLock, address])

  return (
    <div className="space-y-6">
      <WithdrawVMooney />
      
      <LockData
        hasLock={hasLock}
        VMOONEYBalance={VMOONEYBalance}
        VMOONEYBalanceLoading={VMOONEYBalanceLoading}
        VMOONEYLock={VMOONEYLock}
        VMOONEYLockLoading={VMOONEYLockLoading}
      />

      <div className="mb-6">
        <div className="mb-3">
          <p className="text-gray-300 text-base leading-relaxed">
            Select the blockchain network where you want to lock your MOONEY tokens. 
            Each network has its own voting escrow contract.
          </p>
        </div>
        <NetworkSelector />
      </div>

      {/* Main Lock Interface */}
      <div className="w-full">
        <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
          {!hasExpired ? (
            <div>
              {/* Compact Header */}
              <div className="p-5 border-b border-white/10 bg-black/20">
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
              <div className="p-5 space-y-5">
                {/* Amount Input */}
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">
                    Amount
                  </label>
                  <div className="bg-black/30 rounded-xl p-3 border border-white/10 focus-within:border-blue-400/50 transition-colors">
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
                          setWantsToIncrease(true)
                        }}
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-gray-400 text-sm">
                          MOONEY
                        </span>
                        <button
                          className="text-blue-400 hover:text-blue-300 font-medium transition-colors px-1.5 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded text-xs flex-shrink-0"
                          disabled={
                            (!MOONEYBalance || +MOONEYBalance?.toString() === 0) && !hasLock
                          }
                          onClick={() => {
                            setLockAmount(
                              VMOONEYLock
                                ? formatMooneyAmount(
                                    BigNumber.from(VMOONEYLock[0]).add(
                                      MOONEYBalance || 0
                                    )
                                  )
                                : formatMooneyAmount(
                                    MOONEYBalance?.value.toString() || '0'
                                  )
                            )
                            setWantsToIncrease(true)
                          }}
                        >
                          MAX
                        </button>
                        {hasLock && VMOONEYLock && (
                          <button
                            className="text-orange-400 hover:text-orange-300 font-medium transition-colors px-1.5 py-1 bg-orange-400/10 hover:bg-orange-400/20 rounded text-xs flex-shrink-0"
                            onClick={() => {
                              setLockAmount(formatMooneyAmount(VMOONEYLock[0]))
                              setWantsToIncrease(true)
                            }}
                          >
                            CURRENT
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duration Selection */}
                <div className="space-y-3">
                  <label className="text-gray-300 text-sm font-medium">
                    Lock Until
                  </label>

                  {/* Lock Duration Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '6M', days: 182 },
                      { label: '1Y', days: 365 },
                      { label: '2Y', days: 730 },
                      { label: '4Y', days: 1461 },
                    ].map(({ label, days }) => {
                      const targetDate = dateOut(new Date(), { days })
                      const isSelected =
                        lockTime?.formatted === dateToReadable(targetDate)
                      // Check if the target date is beyond the current lock end time
                      const canSelectThisDate = !hasLock || 
                        (VMOONEYLock && +targetDate > BigNumber.from(VMOONEYLock[1]).mul(1000).toNumber())
                      
                      return (
                        <button
                          key={label}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-blue-500 text-white border border-blue-400'
                              : canSelectThisDate
                              ? 'bg-black/30 text-gray-300 border border-white/10 hover:border-blue-400/50 hover:bg-blue-500/10'
                              : 'bg-gray-700/30 text-gray-500 border border-gray-600/30 cursor-not-allowed'
                          }`}
                          disabled={
                            ((!MOONEYBalance || +MOONEYBalance.toString() === 0) && !hasLock) ||
                            !canSelectThisDate
                          }
                          onClick={() => {
                            setLockTime({
                              value: ethers.BigNumber.from(+targetDate),
                              formatted: dateToReadable(targetDate),
                            })
                            setWantsToIncrease(true)
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Date Input */}
                  <div className="bg-black/30 rounded-xl p-3 border border-white/10 focus-within:border-blue-400/50 transition-colors">
                    <input
                      type="date"
                      className="w-full bg-transparent text-white text-lg font-RobotoMono focus:outline-none"
                      value={lockTime?.formatted}
                      min={
                        hasLock && VMOONEYLock
                          ? dateToReadable(
                              dateOut(bigNumberToDate(BigNumber.from(VMOONEYLock[1])), { days: 1 })
                            )
                          : dateToReadable(dateOut(new Date(), { days: 7 }))
                      }
                      max={minMaxLockTime.max}
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
                            {calculateVMOONEY({
                              CurrentMOONEYLock: formatMooneyAmount(
                                VMOONEYLock?.[0] || 0
                              ),
                              MOONEYAmount:
                                +lockAmount ||
                                parseFloat(formatMooneyAmount(
                                  VMOONEYLock?.[0] || 0
                                )),
                              VMOONEYAmount: transformNumber(
                                VMOONEYBalance
                                  ? +VMOONEYBalance?.toString() / 10 ** 18
                                  : 0,
                                NumberType.number
                              ),
                              time: Date.parse(lockTime.formatted),
                              lockTime: Date.parse(
                                hasLock && lockTime?.orig
                                  ? lockTime.orig.formatted
                                  : new Date()
                              ),
                              max: Date.parse(minMaxLockTime.max),
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Voting Power */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm">
                          Voting Power
                        </span>
                        <div className="text-right min-w-0 flex-shrink-0">
                          <span className="text-white text-xl font-RobotoMono">
                            {(() => {
                              const vMooneyAmount = parseFloat(
                                calculateVMOONEY({
                                  CurrentMOONEYLock:
                                    formatMooneyAmount(
                                      VMOONEYLock?.[0] || 0
                                    ),
                                  MOONEYAmount:
                                    +lockAmount ||
                                    parseFloat(formatMooneyAmount(
                                      VMOONEYLock?.[0] || 0
                                    )),
                                  VMOONEYAmount: transformNumber(
                                    VMOONEYBalance
                                      ? +VMOONEYBalance?.toString() /
                                          10 ** 18
                                      : 0,
                                    NumberType.number
                                  ),
                                  time: Date.parse(lockTime.formatted),
                                  lockTime: Date.parse(
                                    hasLock && lockTime?.orig
                                      ? lockTime.orig.formatted
                                      : new Date()
                                  ),
                                  max: Date.parse(minMaxLockTime.max),
                                }).toString()
                              )
                              return Math.sqrt(vMooneyAmount).toFixed(2)
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Action Section */}
              <div className="p-5 border-t border-white/10 bg-black/10">
                <PrivyWeb3Button
                  v5
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-[1.01] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
                  label={
                    !hasLock
                      ? 'Lock MOONEY'
                      : canIncrease.amount && canIncrease.time
                      ? 'Increase Lock'
                      : canIncrease.amount && !canIncrease.time
                      ? 'Increase Amount'
                      : !canIncrease.amount && canIncrease.time
                      ? 'Extend Duration'
                      : 'Update Lock'
                  }
                  action={async () => {
                    try {
                      if (!account)
                        throw new Error('No account connected')
                      const lockedMooney = VMOONEYLock?.[0]
                      const lockAmountBigNum =
                        ethers.utils.parseEther(lockAmount)

                      const increaseAmount = lockedMooney
                        ? lockAmountBigNum.sub(lockedMooney)
                        : lockAmountBigNum

                      // Only check approval if we're actually increasing the amount
                      if (increaseAmount.gt(0) && increaseAmount.gt(tokenAllowance)) {
                        const approvalReceipt = await approveToken({
                          account,
                          tokenContract: mooneyContract,
                          spender: VMOONEY_ADDRESSES[chainSlug],
                          allowance: increaseAmount,
                        })
                        approvalReceipt &&
                          toast.success(
                            'Successfully approved MOONEY for lock.'
                          )
                      }

                      const lockReceipt: any = hasLock
                        ? await increaseLock({
                            account,
                            votingEscrowContract: vMooneyContract,
                            newAmount:
                              increaseAmount.gt(0) ? increaseAmount : undefined,
                            currentTime: VMOONEYLock && VMOONEYLock[1],
                            newTime: lockTime?.value.div(1000),
                          })
                        : await createLock({
                            account,
                            votingEscrowContract: vMooneyContract,
                            amount:
                              lockAmount &&
                              ethers.utils.parseEther(lockAmount),
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
          ) : (
            <div className="p-6 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-red-500/20 mx-auto mb-3 flex items-center justify-center">
                  <span className="text-red-400 text-xl">⏰</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Lock Expired
                </h3>
                <p className="text-gray-300 text-sm mb-5">
                  Your lock has expired. You can now withdraw your MOONEY tokens.
                </p>
                <PrivyWeb3Button
                  v5
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                  label="Withdraw"
                  action={async () => {
                    if (!account) throw new Error('No account connected')
                    try {
                      const receipt = await withdrawLock({
                        account,
                        votingEscrowContract: vMooneyContract,
                      })
                      if (receipt) {
                        toast.success(
                          'Successfully withdrew your locked MOONEY.'
                        )
                        setRefresh((prev) => !prev)
                      }
                    } catch (error) {
                      toast.error('Withdrawal failed.')
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
