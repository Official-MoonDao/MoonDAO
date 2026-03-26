import { InformationCircleIcon, LockClosedIcon, ScaleIcon, UsersIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useFundWallet } from '@privy-io/react-auth'
import { BigNumber, ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { toast } from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { approveToken } from '../lib/tokens/approve'
import { calculateVMOONEY, createLock, increaseLock, withdrawLock } from '../lib/tokens/ve-token'
import { bigNumberToDate, dateOut, dateToReadable } from '../lib/utils/dates'
import { NumberType, transformNumber } from '../lib/utils/numbers'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import viemChains from '@/lib/viem/viemChains'
import Container from '../components/layout/Container'
import Head from '../components/layout/Head'
import { LockData } from '../components/lock/LockData'
import { PrivyWeb3Button } from '../components/privy/PrivyWeb3Button'
import { AllowanceWarning } from '../components/thirdweb/AllowanceWarning'
import Input from '@/components/layout/Input'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SpaceBackground from '@/components/layout/SpaceBackground'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import RetroactiveRewards from '@/components/tokens/RetroactiveRewards'
import ERC20ABI from '../const/abis/ERC20.json'
import VotingEscrowABI from '../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../const/config'

export default function Lock() {
  const router = useRouter()
  const { selectedChain }: any = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address

  const [refresh, setRefresh] = useState(false)

  const { fundWallet } = useFundWallet()

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

  const [hasExpired, setHasExpired] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasExpired(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          ethers.BigNumber.from(+new Date()).gte(BigNumber.from(VMOONEYLock[1]).mul(1000))
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address])

  const [lockAmount, setLockAmount] = useState<string>('')
  const [isAmountInputFocused, setIsAmountInputFocused] = useState(false)
  //reset lock amount on chain switch
  useEffect(() => {
    setLockAmount('')
    setLockTime({
      value: ethers.BigNumber.from(+oneWeekOut),
      formatted: dateToReadable(oneWeekOut),
    })
  }, [selectedChain])

  const oneWeekOut = dateOut(new Date(), { days: 7 })

  const [lockTime, setLockTime] = useState({
    value: ethers.BigNumber.from(+oneWeekOut),
    formatted: dateToReadable(oneWeekOut),
  } as any)

  const [minMaxLockTime, setMinMaxLockTime] = useState({} as any)

  const [canIncrease, setCanIncrease] = useState({ amount: true, time: true })
  const [wantsToIncrease, setWantsToIncrease] = useState(false)

  const { data: tokenAllowance } = useRead({
    contract: mooneyContract,
    method: 'allowance',
    params: [address, VMOONEY_ADDRESSES[chainSlug]],
    deps: [refresh],
  })

  const hasLock = useMemo(() => {
    return (
      selectedChain &&
      address &&
      !VMOONEYLockLoading &&
      VMOONEYLock &&
      VMOONEYLock[0] &&
      !BigNumber.from(VMOONEYLock[0]).isZero()
    )
  }, [VMOONEYLock, VMOONEYLockLoading, address, selectedChain])

  //Current lock
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      if (!lockAmount || lockAmount === '' || lockAmount === '0') {
        setLockAmount(ethers.utils.formatEther(VMOONEYLock[0]))
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

  // Sync lockTime when invalid (e.g. before lock end when extending)
  useEffect(() => {
    if (hasLock && VMOONEYLock && lockTime?.formatted) {
      const lockEnd = bigNumberToDate(BigNumber.from(VMOONEYLock[1]))
      const minExtendDate = new Date(lockEnd.getTime())
      minExtendDate.setDate(minExtendDate.getDate() + 1)
      if (Date.parse(lockTime.formatted) < minExtendDate.getTime()) {
        setLockTime({
          value: ethers.BigNumber.from(minExtendDate.getTime()),
          formatted: dateToReadable(minExtendDate),
          orig: lockTime.orig,
        })
      }
    }
  }, [hasLock, VMOONEYLock, lockTime?.formatted])

  //Lock time min/max
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      const currentLockEnd = bigNumberToDate(BigNumber.from(VMOONEYLock[1]))
      const maxLockTime = dateOut(new Date(), { days: 1460 }) // 4 years minus 1 day from now

      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(maxLockTime),
      })

      setCanIncrease({
        amount:
          lockAmount &&
          lockAmount !== '' &&
          lockAmount !== '0' &&
          VMOONEYLock &&
          ethers.utils.parseEther(lockAmount).gt(VMOONEYLock[0]),
        time:
          lockTime?.value &&
          lockTime.value.gt(BigNumber.from(VMOONEYLock[1]).mul(1000)) && // New time must be greater than current lock end
          lockTime.value.lte(BigNumber.from(+maxLockTime)), // New time must be within max lock time
      })
    } else {
      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(dateOut(new Date(), { days: 1460 })),
      })
      setCanIncrease({
        amount: !!(lockAmount && lockAmount !== '' && lockAmount !== '0'),
        time:
          lockTime?.value &&
          lockTime.value.gt(ethers.BigNumber.from(+oneWeekOut)) &&
          lockTime.value.lte(BigNumber.from(+dateOut(new Date(), { days: 1460 }))),
      })
    }
  }, [hasLock, lockAmount, lockTime, VMOONEYLock, address])

  const { t } = useTranslation('common')

  return (
    <>
      <Head title="Lock $MOONEY" />

      <Container is_fullwidth={true}>
        <SpaceBackground />
        <div className="min-h-screen text-white w-full relative z-10">
          {/* Lock MOONEY Section */}
          <section className="pt-10 sm:pt-16 pb-4 sm:pb-6 px-4 sm:px-6 w-full min-h-[100dvh] flex flex-col">
            <div className="max-w-2xl mx-auto w-full">
              <div className="mb-3 sm:mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold font-GoodTimes text-white mb-1 sm:mb-2">
                  Lock MOONEY
                </h1>
                <p className="text-sm sm:text-base text-gray-300">
                  Lock MOONEY to receive vMOONEY and gain voting power in MoonDAO governance.
                </p>
              </div>

              {/* vMOONEY Withdraw Section */}
              <div className="mb-4 sm:mb-6">
                <RetroactiveRewards />
              </div>

              {/* Lock Data Display */}
              <div className="mb-4 sm:mb-6">
                <LockData
                  hasLock={hasLock}
                  VMOONEYBalance={VMOONEYBalance}
                  VMOONEYBalanceLoading={VMOONEYBalanceLoading}
                  VMOONEYLock={VMOONEYLock}
                  VMOONEYLockLoading={VMOONEYLockLoading}
                />
              </div>

              {/* Main Lock Interface - Preserve existing complex logic */}
              <div className="mb-4 sm:mb-6">
                <div className="w-full mt-6">
                  <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                    {!hasExpired ? (
                      <div>
                        {/* Compact Header */}
                        <div className="p-5 border-b border-white/10 bg-black/20">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <h2 className="text-xl font-bold text-white">Lock MOONEY</h2>
                              <p className="text-gray-400 text-xs mt-0.5">Earn voting power</p>
                            </div>
                            <div className="flex-shrink-0">
                              <NetworkSelector compact />
                            </div>
                          </div>
                        </div>

                        {/* Lock Configuration */}
                        <div className="p-5 space-y-5">
                          {/* Amount Input */}
                          <div className="space-y-2">
                            <label className="text-gray-300 text-sm font-medium">Amount</label>
                            <div className="bg-black/30 rounded-xl p-3 border border-white/10 focus-within:border-blue-400/50 transition-colors">
                              <div className="flex items-center justify-between">
                                <Input
                                  type="text"
                                  placeholder="0.00"
                                  className="text-white bg-transparent text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none flex-1 border-0 p-0"
                                  value={
                                    isAmountInputFocused
                                      ? lockAmount || ''
                                      : lockAmount && !isNaN(parseFloat(lockAmount))
                                      ? parseFloat(lockAmount).toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                      : ''
                                  }
                                  disabled={
                                    (!MOONEYBalance || +MOONEYBalance.toString() === 0) && !hasLock
                                  }
                                  max={
                                    MOONEYBalance
                                      ? parseFloat(
                                          ethers.utils.formatEther(MOONEYBalance.toString())
                                        )
                                      : undefined
                                  }
                                  onFocus={() => {
                                    setIsAmountInputFocused(true)
                                    // Remove formatting when focusing for easier editing
                                    if (lockAmount && !isNaN(parseFloat(lockAmount))) {
                                      setLockAmount(parseFloat(lockAmount).toString())
                                    }
                                  }}
                                  onBlur={() => {
                                    setIsAmountInputFocused(false)
                                    // Format the value on blur if it's a valid number
                                    if (lockAmount && !isNaN(parseFloat(lockAmount))) {
                                      const numValue = parseFloat(lockAmount)
                                      setLockAmount(numValue.toString())
                                    }
                                  }}
                                  onChange={(e: any) => {
                                    let value = e.target.value
                                    // Remove commas and non-numeric characters except decimal point
                                    value = value.replace(/[^0-9.]/g, '')

                                    // Prevent multiple decimal points
                                    const parts = value.split('.')
                                    if (parts.length > 2) {
                                      value = parts[0] + '.' + parts.slice(1).join('')
                                    }

                                    // Prevent negative values
                                    if (parseFloat(value) < 0) {
                                      value = '0'
                                    }

                                    // Enforce max value (available MOONEY balance)
                                    if (MOONEYBalance) {
                                      const maxValue = parseFloat(
                                        ethers.utils.formatEther(MOONEYBalance.toString())
                                      )
                                      if (parseFloat(value) > maxValue) {
                                        value = maxValue.toString()
                                      }
                                    }

                                    // Remove leading zero if user types a number after it
                                    if (
                                      value.startsWith('0') &&
                                      value.length > 1 &&
                                      value[1] !== '.'
                                    ) {
                                      value = value.substring(1)
                                    }
                                    setLockAmount(value)
                                    setWantsToIncrease(true)
                                  }}
                                  formatNumbers={true}
                                  maxWidth="max-w-none"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-gray-400 text-sm">MOONEY</span>
                                  {MOONEYBalanceLoading ? (
                                    <span className="text-gray-500 text-xs animate-pulse">...</span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">
                                      Available:{' '}
                                      <span className="text-gray-400 font-RobotoMono">
                                        {(hasLock && VMOONEYLock
                                          ? parseFloat(
                                              ethers.utils.formatEther(
                                                BigNumber.from(VMOONEYLock[0]).add(
                                                  MOONEYBalance || 0
                                                )
                                              )
                                            )
                                          : parseFloat(
                                              ethers.utils.formatEther(
                                                MOONEYBalance?.toString() || '0'
                                              )
                                            )
                                        ).toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </span>
                                  )}
                                  <button
                                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors px-2 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded text-xs"
                                    disabled={
                                      (!MOONEYBalance || +MOONEYBalance?.toString() === 0) &&
                                      !hasLock
                                    }
                                    onClick={() => {
                                      setLockAmount(
                                        VMOONEYLock
                                          ? ethers.utils.formatEther(
                                              BigNumber.from(VMOONEYLock[0]).add(MOONEYBalance || 0)
                                            )
                                          : ethers.utils.formatEther(
                                              MOONEYBalance?.toString() || '0'
                                            )
                                      )
                                      setWantsToIncrease(true)
                                    }}
                                  >
                                    MAX
                                  </button>
                                  {hasLock && VMOONEYLock && (
                                    <button
                                      className="text-orange-400 hover:text-orange-300 font-medium transition-colors px-2 py-1 bg-orange-400/10 hover:bg-orange-400/20 rounded text-xs"
                                      onClick={() => {
                                        setLockAmount(ethers.utils.formatEther(VMOONEYLock[0]))
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
                            <label className="text-gray-300 text-sm font-medium">Lock Until</label>

                            {(() => {
                              const now = new Date()
                              const lockEndDate = hasLock && VMOONEYLock
                                ? bigNumberToDate(BigNumber.from(VMOONEYLock[1]))
                                : null
                              const effectiveMinDays = lockEndDate
                                ? Math.ceil((lockEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                : 7
                              const maxDays = 1460
                              const currentDays = lockTime?.formatted
                                ? Math.round((Date.parse(lockTime.formatted) - now.getTime()) / (1000 * 60 * 60 * 24))
                                : effectiveMinDays
                              const clampedDays = Math.max(effectiveMinDays, Math.min(maxDays, currentDays))
                              const minDate = (() => {
                                const d = new Date(now.getTime())
                                d.setDate(d.getDate() + 7)
                                return d
                              })()

                              const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                                const rawDays = parseInt(e.target.value, 10)
                                const days = Math.max(effectiveMinDays, Math.min(maxDays, rawDays))
                                const targetDate = new Date(now.getTime())
                                targetDate.setDate(targetDate.getDate() + days)
                                setLockTime({
                                  ...lockTime,
                                  value: ethers.BigNumber.from(targetDate.getTime()),
                                  formatted: dateToReadable(targetDate),
                                })
                                setWantsToIncrease(true)
                              }

                              return (
                                <>
                                  <div className="bg-black/30 rounded-xl p-4 border border-white/10 focus-within:border-blue-400/50 transition-colors">
                                    <input
                                      type="range"
                                      min={7}
                                      max={maxDays}
                                      step={1}
                                      value={clampedDays}
                                      disabled={
                                        (!MOONEYBalance || +MOONEYBalance.toString() === 0) && !hasLock
                                      }
                                      onChange={handleSliderChange}
                                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <div className="flex justify-between items-center mt-2 gap-2">
                                      <span className="text-gray-500 text-xs flex-shrink-0">
                                        7 days
                                      </span>
                                      <span className="text-white text-lg font-RobotoMono font-semibold text-center truncate min-w-0">
                                        {lockTime?.formatted || dateToReadable(minDate)}
                                      </span>
                                      <span className="text-gray-500 text-xs flex-shrink-0">
                                        4 years
                                      </span>
                                    </div>
                                    {hasLock && (
                                      <p className="text-blue-400/80 text-xs mt-2 flex items-center gap-1.5">
                                        <InformationCircleIcon className="h-4 w-4 flex-shrink-0" aria-hidden />
                                        You can only extend your lock—sliding left is disabled to prevent shortening your lock duration.
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-gray-400 text-xs mt-1">
                                    Minimum lock period: 7 days • Maximum: 4 years
                                  </p>
                                </>
                              )
                            })()}
                          </div>

                          {/* Voting Power Preview */}
                          {(canIncrease.time || canIncrease.amount) && wantsToIncrease && (
                            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-400/20 space-y-3">
                              <p className="text-gray-300 text-xs">
                                Locking MOONEY gives you vMOONEY tokens. Your voting power is
                                calculated as the square root of your vMOONEY balance.
                              </p>

                              {/* vMOONEY Amount */}
                              <div className="flex items-center justify-between">
                                <span className="text-gray-300 text-sm">vMOONEY Received</span>
                                <div className="text-right min-w-0 flex-shrink-0">
                                  <span className="text-white text-xl font-RobotoMono">
                                    {calculateVMOONEY({
                                      CurrentMOONEYLock: ethers.utils.formatEther(
                                        VMOONEYLock?.[0] || 0
                                      ),
                                      MOONEYAmount:
                                        +lockAmount ||
                                        ethers.utils.formatEther(VMOONEYLock?.[0] || 0),
                                      VMOONEYAmount: transformNumber(
                                        VMOONEYBalance ? +VMOONEYBalance?.toString() / 10 ** 18 : 0,
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
                                <span className="text-gray-300 text-sm">Voting Power</span>
                                <div className="text-right min-w-0 flex-shrink-0">
                                  <span className="text-white text-xl font-RobotoMono">
                                    {(() => {
                                      const vMooneyAmount = parseFloat(
                                        calculateVMOONEY({
                                          CurrentMOONEYLock: ethers.utils.formatEther(
                                            VMOONEYLock?.[0] || 0
                                          ),
                                          MOONEYAmount:
                                            +lockAmount ||
                                            ethers.utils.formatEther(VMOONEYLock?.[0] || 0),
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
                                        })
                                          .toString()
                                          .replace(/,/g, '')
                                      )
                                      const votingPower = Math.sqrt(vMooneyAmount)
                                      return votingPower.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
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
                                if (!account) throw new Error('No account connected')

                                // Additional validation before attempting lock
                                const maxLockTime = dateOut(new Date(), {
                                  days: 1460,
                                })
                                if (
                                  lockTime?.value &&
                                  lockTime.value.gt(BigNumber.from(+maxLockTime))
                                ) {
                                  throw new Error(
                                    'Lock period cannot exceed 4 years. Please adjust your lock duration.'
                                  )
                                }

                                const lockedMooney = VMOONEYLock?.[0]
                                const lockAmountBigNum = ethers.utils.parseEther(lockAmount)

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
                                    toast.success('Successfully approved MOONEY for lock.')
                                }

                                const lockReceipt: any = hasLock
                                  ? await increaseLock({
                                      account,
                                      votingEscrowContract: vMooneyContract,
                                      newAmount: increaseAmount.gt(0) ? increaseAmount : undefined,
                                      currentTime: VMOONEYLock && VMOONEYLock[1],
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
                              } catch (error: any) {
                                // Check for specific error messages related to lock time limits
                                if (
                                  error.message?.includes('Lock period') ||
                                  error.message?.includes('exceed') ||
                                  error.reason?.includes('VOTING_ESCROW_LOCK_TIME_TOO_BIG')
                                ) {
                                  toast.error(
                                    'Lock period exceeds maximum allowed time. Please reduce the lock duration.'
                                  )
                                } else {
                                  throw error
                                }
                              }
                            }}
                            isDisabled={
                              // For new locks, require both amount and time
                              !hasLock
                                ? !lockAmount ||
                                  lockAmount === '' ||
                                  lockAmount === '0' ||
                                  !canIncrease.time
                                : // For existing locks, allow if either amount or time can be increased
                                  !canIncrease.amount && !canIncrease.time
                            }
                          />

                          {/* Allowance Warning */}
                          <div className="mt-4">
                            <AllowanceWarning
                              tokenContract={mooneyContract}
                              spender={VMOONEY_ADDRESSES[selectedChain.slug]}
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
                          <h3 className="text-lg font-bold text-white mb-2">Lock Expired</h3>
                          <p className="text-gray-300 text-sm mb-5">{t('expDesc')}</p>
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
                                  toast.success('Successfully withdrew your locked MOONEY.')
                                  setTimeout(() => {
                                    router.reload()
                                  }, 3000)
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

              {/* Next Steps */}
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">After Locking</h3>
                  <p className="text-gray-300 text-sm">
                    Once you lock MOONEY tokens, you'll receive vMOONEY for voting in governance
                    proposals.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Link
                      href="/get-mooney"
                      className="block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-center"
                    >
                      Buy More MOONEY
                    </Link>
                    <Link
                      href="/projects"
                      className="block bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-center"
                    >
                      Vote on Proposals
                    </Link>
                  </div>
                  <div className="text-center text-xs text-gray-400 mt-4">
                    Longer lock periods give you more voting power per token
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="flex justify-center w-full">
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          </div>
        </div>
      </Container>
    </>
  )
}
