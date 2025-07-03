import { useFundWallet } from '@privy-io/react-auth'
import { BigNumber, ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { toast } from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { approveToken } from '../lib/tokens/approve'
import {
  calculateVMOONEY,
  createLock,
  increaseLock,
  withdrawLock,
} from '../lib/tokens/ve-token'
import { bigNumberToDate, dateOut, dateToReadable } from '../lib/utils/dates'
import { NumberType, transformNumber } from '../lib/utils/numbers'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import viemChains from '@/lib/viem/viemChains'
import Balance from '../components/Balance'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import Head from '../components/layout/Head'
import { LockData } from '../components/lock/LockData'
import { PrivyWeb3Button } from '../components/privy/PrivyWeb3Button'
import { AllowanceWarning } from '../components/thirdweb/AllowanceWarning'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import WithdrawVMooney from '@/components/tokens/WithdrawVMooney'
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
          ethers.BigNumber.from(+new Date()).gte(
            BigNumber.from(VMOONEYLock[1]).mul(1000)
          )
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address])

  const [lockAmount, setLockAmount] = useState<string>('')
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
      VMOONEYLock[0] != 0
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

  //Lock time min/max
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      const currentLockEnd = bigNumberToDate(BigNumber.from(VMOONEYLock[1]))
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

  const { t } = useTranslation('common')

  return (
    <>
      <Head title="Lock $MOONEY" />
      <div className="w-full">
        <ContentLayout
          header="Lock $MOONEY"
          headerSize="max(20px, 3vw)"
          description={
            <div className="max-w-full">
              <p>
                {'Playing an active role in MoonDAO governance is simple: '}
                <button
                  className="underline"
                  onClick={() => {
                    if (!address)
                      return toast.error('Please connect your wallet.')
                    fundWallet(address, {
                      chain: viemChains[selectedChain.slug],
                    })
                  }}
                >
                  {'fund your account'}
                </button>
                {',  '}
                <button
                  className="underline"
                  onClick={() => router.push('/get-mooney')}
                >
                  {'swap for $MOONEY'}
                </button>
                {', and '}
                <button
                  className="underline"
                  onClick={() => {
                    router.push('/lock')
                  }}
                >
                  {'lock for voting power'}
                </button>
                {'.'}
              </p>
            </div>
          }
          preFooter={
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          }
          mainPadding
          isProfile
          mode="compact"
          popOverEffect={false}
        >
          <div className="max-w-2xl mx-auto">
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
                  Select the blockchain network where you want to lock your
                  MOONEY tokens. Each network has its own voting escrow
                  contract.
                </p>
              </div>
              <NetworkSelector />
            </div>

            {/* Main Lock Interface */}
            <div className="w-full mt-6">
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
                                  type="number"
                                  step="any"
                                  placeholder="0.0"
                                  className="text-white bg-transparent text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={lockAmount || ''}
                                  disabled={
                                    (!MOONEYBalance || +MOONEYBalance.toString() === 0) && !hasLock
                                  }
                                  min={
                                    VMOONEYLock
                                      ? ethers.utils.formatEther(VMOONEYLock?.[0])
                                      : 0
                                  }
                                  onChange={(e: any) => {
                                    let value = e.target.value
                                    // Prevent negative values
                                    if (parseFloat(value) < 0) {
                                      value = '0'
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
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-sm">
                                    MOONEY
                                  </span>
                                  <button
                                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors px-2 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded text-xs"
                                    disabled={
                                      (!MOONEYBalance || +MOONEYBalance?.toString() === 0) && !hasLock
                                    }
                                    onClick={() => {
                                      setLockAmount(
                                        VMOONEYLock
                                          ? ethers.utils.formatEther(
                                              BigNumber.from(VMOONEYLock[0]).add(
                                                MOONEYBalance || 0
                                              )
                                            )
                                          : ethers.utils.formatEther(
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
                                  Locking MOONEY gives you vMOONEY tokens. Your
                                  voting power is calculated as the square root of
                                  your vMOONEY balance.
                                </p>

                                {/* vMOONEY Amount */}
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300 text-sm">
                                    vMOONEY Received
                                  </span>
                                  <div className="text-right min-w-0 flex-shrink-0">
                                    <span className="text-white text-xl font-RobotoMono">
                                      {calculateVMOONEY({
                                        CurrentMOONEYLock: ethers.utils.formatEther(
                                          VMOONEYLock?.[0] || 0
                                        ),
                                        MOONEYAmount:
                                          +lockAmount ||
                                          ethers.utils.formatEther(
                                            VMOONEYLock?.[0] || 0
                                          ),
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
                                              ethers.utils.formatEther(
                                                VMOONEYLock?.[0] || 0
                                              ),
                                            MOONEYAmount:
                                              +lockAmount ||
                                              ethers.utils.formatEther(
                                                VMOONEYLock?.[0] || 0
                                              ),
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
                          <h3 className="text-lg font-bold text-white mb-2">
                            Lock Expired
                          </h3>
                          <p className="text-gray-300 text-sm mb-5">
                            {t('expDesc')}
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
        </ContentLayout>
      </div>
    </>
  )
}
