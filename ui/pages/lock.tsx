//This is full of functions and console.logs
import {
  MoonIcon,
  LockClosedIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { Web3Button, useAddress, useContract } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import { useContext, useEffect, useState } from 'react'
import React from 'react'
import { toast } from 'react-hot-toast'
import ChainContext from '../lib/thirdweb/chain-context'
import { useTokenAllowance, useTokenApproval } from '../lib/tokens/approve'
import { useMOONEYBalance } from '../lib/tokens/mooney-token'
import {
  useVMOONEYBalance,
  useVMOONEYLock,
  useVMOONEYCreateLock,
  useVMOONEYIncreaseLock,
  useVMOONEYWithdrawLock,
} from '../lib/tokens/ve-token'
import { NumberType, transformNumber } from '../lib/utils/numbers'
import { formatEther } from 'ethers/lib/utils'
import Balance from '../components/Balance'
import TimeRange from '../components/TimeRange'
import Head from '../components/layout/Head'
import L2Toggle from '../components/lock/L2Toggle'
import { AllowanceWarning } from '../components/thirdweb/AllowanceWarning'
import LockPresets from '../components/thirdweb/LockPresets'
import ERC20ABI from '../const/abis/ERC20.json'
import VotingEscrow from '../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../const/config'

const dateToReadable = (date: any) => {
  return date && date.toISOString().substring(0, 10)
}

const bigNumberToDate = (bigNumber: any) => {
  return bigNumber && new Date(bigNumber.mul(1000).toNumber())
}

const dateOut = (date: any, { days, years }: any) => {
  if (!date) return
  let dateOut = date
  days && dateOut.setDate(date.getDate() + days)
  years && dateOut.setFullYear(date.getFullYear() + years)
  return dateOut
}

const calculateVMOONEY = ({
  MOONEYAmount,
  VMOONEYAmount,
  time,
  lockTime,
  max,
}: any) => {
  if (!MOONEYAmount) return 0

  const vestingStart = calculateVestingStart({
    MOONEYAmount,
    VMOONEYAmount,
    lockTime,
  })
  const percentage = (time - vestingStart) / (max - vestingStart)
  const finalVMOONEYAmount = MOONEYAmount * percentage
  return finalVMOONEYAmount.toFixed(finalVMOONEYAmount > 1 ? 2 : 8)
}

const calculateVestingStart = ({
  MOONEYAmount,
  VMOONEYAmount,
  lockTime,
}: any) => {
  const fourYears = 31556926000 * 4
  return lockTime - (VMOONEYAmount / MOONEYAmount) * fourYears
}

export default function Lock() {
  const address = useAddress()

  const { selectedChain }: any = useContext(ChainContext)

  const { contract: mooneyContract }: any = useContract(
    MOONEY_ADDRESSES[selectedChain?.slug],
    ERC20ABI.abi
  )

  const { contract: vMooneyContract }: any = useContract(
    VMOONEY_ADDRESSES[selectedChain?.slug],
    VotingEscrow.abi
  )
  const { data: MOONEYBalance, isLoading: MOONEYBalanceLoading } =
    useMOONEYBalance(mooneyContract, address)

  const { data: VMOONEYBalance, isLoading: VMOONEYBalanceLoading } =
    useVMOONEYBalance(vMooneyContract, address)

  const { data: VMOONEYLock, isLoading: VMOONEYLockLoading } = useVMOONEYLock(
    vMooneyContract,
    address
  )

  const [hasLock, setHasLock] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading && setHasLock(VMOONEYLock && VMOONEYLock[0] != 0)
  }, [VMOONEYLock, address])

  const [hasExpired, setHasExpired] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasExpired(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          ethers.BigNumber.from(+new Date()).gte(VMOONEYLock[1].mul(1000))
      )
  }, [VMOONEYLock, address])

  const [lockAmount, setLockAmount] = useState<string>('0')

  const oneWeekOut = dateOut(new Date(), { days: 7 })

  const [lockTime, setLockTime] = useState({
    value: ethers.BigNumber.from(+oneWeekOut),
    formatted: dateToReadable(oneWeekOut),
  } as any)

  const [minMaxLockTime, setMinMaxLockTime] = useState({} as any)

  const [canIncrease, setCanIncrease] = useState({ amount: true, time: true })
  const [wantsToIncrease, setWantsToIncrease] = useState(false)

  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    lockAmount && ethers.utils?.parseEther(lockAmount),
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address || '',
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { mutateAsync: createLock } = useVMOONEYCreateLock(
    vMooneyContract,
    lockAmount && ethers.utils.parseEther(lockAmount),
    lockTime.value.div(1000)
  )

  const { mutateAsync: increaseLock } = useVMOONEYIncreaseLock({
    votingEscrowContract: vMooneyContract,
    currentAmount: VMOONEYLock && VMOONEYLock[0],
    newAmount:
      lockAmount &&
      VMOONEYLock &&
      ethers.utils.parseEther(lockAmount).sub(VMOONEYLock[0]),
    currentTime: VMOONEYLock && VMOONEYLock[1],
    newTime: lockTime?.value.div(1000),
  })

  const { mutateAsync: withdraw } = useVMOONEYWithdrawLock(vMooneyContract)

  //Current lock
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      !lockAmount && setLockAmount(ethers.utils.formatEther(VMOONEYLock[0]))
      const origTime = {
        value: VMOONEYLock[1],
        formatted: dateToReadable(bigNumberToDate(VMOONEYLock[1])),
      }
      !lockTime && lockTime.orig
      setLockTime({
        ...origTime,
        orig: origTime,
      })
    } else {
      setLockTime({
        value: ethers.BigNumber.from(+oneWeekOut),
        formatted: dateToReadable(oneWeekOut),
      })
    }
  }, [hasLock, VMOONEYLock])

  //Lock time min/max
  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(dateOut(new Date(Date.now()), { days: 1461 })),
      })
      setCanIncrease({
        amount: (lockAmount &&
          ethers.utils.parseEther(lockAmount).gt(VMOONEYLock[0])) as boolean,
        time:
          lockTime?.value &&
          lockTime.value.gt(
            +dateOut(bigNumberToDate(VMOONEYLock[1]), { days: 7 })
          ),
      })
    } else {
      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(dateOut(new Date(), { days: 1461 })),
      })
    }
  }, [hasLock, lockAmount, lockTime, VMOONEYLock])

  const { t } = useTranslation('common')

  return (
    <main className="animate-fadeIn">
      <Head title="$vMOONEY" />
      <div className="mt-3 px-5 xl:px-10 py-12 xl:py-24 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark xl:flex xl:flex-col xl:items-center">
        <h1
          className={`font-GoodTimes tracking-wide leading-relaxed text-center text-2xl xl:text-4xl font-semibold mb-2 text-title-light dark:text-title-dark`}
        >
          {t('lockCardTitle')}
        </h1>

        <p className="my-6 xl:my-10 text-lg xl:text-xl leading-8 text-center text-light-text dark:text-dark-text dark:text-opacity-80">
          {t('lockTitle')}{' '}
        </p>

        <a
          className="my-5 xl:text-lg block text-center text-md font-GoodTimes font-semibold bg-gradient-to-r from-blue-500 to-blue-700 dark:decoration-detail-dark dark:from-moon-gold dark:to-stronger-dark  underline decoration-detail-light hover:scale-105 transition-all duration-150 text-transparent bg-clip-text"
          href="https://docs.moondao.com/token/#vmooney-characteristics"
          target="_blank"
          rel="noreferrer"
        >
          {t('learnMore')}
        </a>

        <section className="xl:w-3/4">
          {/*Lock description section*/}
          {!hasLock && (
            <div>
              <p className="mt-6 font-mono text-base xl:text-lg xl:leading-10 text-center leading-8 text-light-text dark:text-dark-text dark:text-opacity-80">
                {t('lockDesc')}
              </p>
            </div>
          )}
          {/*Lock Data, not done yet*/}
          {hasLock && (
            <>
              <div className="card stats-vertical lg:stats-horizontal shadow mb-4">
                <div className="stat">
                  <div className="white-text stat-figure text-primary">
                    <MoonIcon className="h-8 w-8" />
                  </div>
                  <div className="white-text">{t('hasLockMoney1')}</div>
                  <div className="stat-value text-primary">
                    <Balance
                      balance={VMOONEYBalance?.toString() / 10 ** 18}
                      loading={VMOONEYBalanceLoading}
                      decimals={
                        VMOONEYBalance &&
                        VMOONEYBalance?.gt(ethers.utils.parseEther('1'))
                          ? 2
                          : 8
                      }
                    />
                  </div>
                </div>

                <div className="stat">
                  <div className="white-text stat-figure text-secondary">
                    <LockClosedIcon className="h-8 w-8" />
                  </div>
                  <div className="white-text">{t('hasLockMoney2')}</div>
                  <div className="stat-value text-secondary">
                    <Balance
                      balance={VMOONEYLock && VMOONEYLock[0]}
                      loading={VMOONEYLockLoading}
                      decimals={2}
                    />
                  </div>
                </div>
              </div>

              <div className="card stats-vertical lg:stats-horizontal shadow mb-4">
                <div className="stat">
                  <div className="stat-figure">
                    <ClockIcon className="h-8 w-8" />
                  </div>
                  <div className="white-text">{t('yourlockExpDate')}</div>
                  <div className="yellow-text stat-value">
                    {VMOONEYLock &&
                      dateToReadable(bigNumberToDate(VMOONEYLock?.[1]))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="my-5 xl:mt-8 flex justify-center">
          <L2Toggle />
        </div>

        {/*Separating line*/}
        <div className="my-8 xl:mt-5 w-full flex justify-center">
          <div className="flex justify-center h-[2px] bg-gradient-to-r from-detail-light to-moon-blue dark:from-detail-dark dark:to-moon-gold lg:mt-7 lg:h-[3px] w-5/6"></div>
        </div>

        {/*Locking Section*/}
        <div className="text-light-text dark:text-dark-text xl:w-3/4">
          <div className="flex flex-col">
            {!hasExpired ? (
              <div>
                {/*Available to Lock*/}
                <p className="text-sm uppercase font-semibold xl:text-base">
                  {t('lockAvailableMoney')}{' '}
                  <Balance
                    balance={MOONEYBalance?.toString() / 10 ** 18}
                    loading={MOONEYBalanceLoading}
                  />
                </p>
                {/*Lock Amount label*/}

                <label className="mt-6">
                  <p className="uppercase font-semibold underline text-title-light dark:text-title-dark">
                    {t('lockAmount')}
                  </p>
                  <p
                    className={`tracking-wider text-sm opacity-80 text-light-text dark:text-dark-text mt-3 ${
                      hasLock && canIncrease.time ? 'animate-highlight' : ''
                    }`}
                  >
                    {t('lockAmountDesc')}
                    {hasLock && canIncrease.time ? t('lockAmountNote') : ''}
                  </p>
                </label>

                {/*Input for Lock amount*/}
                <div className="mt-4 flex items-center justify-between pl-6 h-[37px] rounded-full overflow-hidden bg-gray-200 dark:bg-slate-800 border border-detail-light dark:border-detail-dark">
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full text-title-light dark:text-title-dark bg-gray-200 dark:bg-slate-800 truncate font-semibold tracking-wide"
                    value={lockAmount || ''}
                    disabled={
                      !MOONEYBalance ||
                      +MOONEYBalance.toString() === 0 ||
                      (hasLock && canIncrease.time)
                        ? true
                        : false
                    }
                    min={
                      VMOONEYLock
                        ? ethers.utils.formatEther(VMOONEYLock?.[0])
                        : 0
                    }
                    onChange={(e: any) => {
                      setLockAmount(e.target.value)
                      setWantsToIncrease(true)
                    }}
                  />
                  {/*MAX button*/}
                  <button
                    className="w-[80px] bg-moon-blue dark:bg-moon-gold text-white font-semibold uppercase h-full"
                    disabled={
                      !MOONEYBalance ||
                      +MOONEYBalance?.toString() === 0 ||
                      (hasLock && canIncrease.time)
                        ? true
                        : false
                    }
                    onClick={() => {
                      setLockAmount(
                        VMOONEYLock
                          ? ethers.utils.formatEther(
                              VMOONEYLock[0].add(MOONEYBalance)
                            )
                          : ethers.utils.formatEther(MOONEYBalance)
                      )
                      setWantsToIncrease(true)
                    }}
                  >
                    Max
                  </button>
                </div>

                {/*Lock Expiration date label*/}
                <label className="mt-6">
                  <p className="uppercase font-semibold underline text-title-light dark:text-title-dark">
                    {t('lockExpDate')}
                  </p>
                  <p className="tracking-wider text-sm opacity-80 text-light-text dark:text-dark-text mt-3">
                    {t('lockDesc2')}
                    {hasLock && canIncrease.amount ? t('lockAmountNote') : ''}
                  </p>
                </label>

                {/*Date input for Lock expiration date*/}
                <input
                  type="date"
                  placeholder={t('lockExpDate')}
                  className="mt-4 input input-bordered w-full text-title-light dark:text-title-dark bg-gray-200 dark:bg-slate-800 border border-detail-light dark:border-detail-dark"
                  value={lockTime?.formatted}
                  min={
                    hasLock && address
                      ? dateToReadable(bigNumberToDate(VMOONEYLock?.[1]))
                      : minMaxLockTime.min
                  }
                  max={minMaxLockTime.max}
                  disabled={
                    !MOONEYBalance ||
                    +MOONEYBalance.toString() === 0 ||
                    (hasLock && canIncrease.amount)
                      ? true
                      : false
                  }
                  onChange={(e: any) => {
                    setLockTime({
                      ...lockTime,
                      formatted: e.target.value
                        ? e.target.value
                        : lockTime.orig.formatted,
                      value: e.target.value
                        ? ethers.BigNumber.from(Date.parse(e.target.value))
                        : lockTime.orig.value,
                    })
                    setWantsToIncrease(!!e.target.value)
                  }}
                />

                {/*Lock Preset buttons*/}
                <LockPresets
                  disabled={
                    !MOONEYBalance ||
                    +MOONEYBalance?.toString() === 0 ||
                    (hasLock && canIncrease.amount)
                      ? true
                      : false
                  }
                  expirationTime={
                    VMOONEYLock
                      ? Date.parse(bigNumberToDate(VMOONEYLock?.[1]))
                      : Date.now
                  }
                  displaySteps={!hasLock}
                  onChange={(newDate: any) => {
                    setWantsToIncrease(true)
                    setLockTime({
                      ...lockTime,
                      formatted: dateToReadable(newDate),
                      value: ethers.BigNumber.from(Date.parse(newDate)),
                    })
                  }}
                />
                {/*Slider*/}
                <TimeRange
                  disabled={
                    !address ||
                    +MOONEYBalance?.toString() === 0 ||
                    (hasLock && canIncrease.amount)
                      ? true
                      : false
                  }
                  time={Date.parse(lockTime?.formatted)}
                  min={Date.parse(minMaxLockTime.min)}
                  max={Date.parse(minMaxLockTime.max)}
                  displaySteps={!hasLock}
                  onChange={(newDate: any) => {
                    if (
                      Date.parse(newDate) <
                      Date.parse(
                        dateToReadable(bigNumberToDate(VMOONEYLock?.[1]))
                      )
                    ) {
                      setWantsToIncrease(false)
                    } else {
                      setWantsToIncrease(true)
                      setLockTime({
                        ...lockTime,
                        formatted: dateToReadable(newDate),
                        value: ethers.BigNumber.from(Date.parse(newDate)),
                      })
                    }
                  }}
                />
                {/*Lock amount*/}
                {(canIncrease.time || canIncrease.amount) &&
                  wantsToIncrease && (
                    <p className="mt-4 text-sm uppercase font-semibold">
                      {t('lockBalance')}{' '}
                      <span className=" text-title-light dark:text-title-dark font-bold text-base inline-block">
                        {calculateVMOONEY({
                          CurrentMOONEYLock: ethers.utils.formatEther(
                            VMOONEYLock?.[0] || 0
                          ),
                          MOONEYAmount: lockAmount && +lockAmount,
                          VMOONEYAmount: transformNumber(
                            +VMOONEYBalance?.toString() / 10 ** 18 || 0,
                            NumberType.number
                          ),
                          time: Date.parse(lockTime.formatted),
                          lockTime: Date.parse(
                            hasLock && lockTime?.orig
                              ? lockTime.orig.formatted
                              : new Date()
                          ),
                          max: Date.parse(minMaxLockTime.max),
                        })}{' '}
                        $vMOONEY
                      </span>
                    </p>
                  )}

                {/*Web3 button with actions according context*/}
                <div className="card-actions mt-4 white-text">
                  <Web3Button
                    contractAddress={''}
                    className={`hover:!text-title-light dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark ${
                      (hasLock &&
                        ((canIncrease.amount && canIncrease.time) ||
                          (!canIncrease.amount && !canIncrease.time))) ||
                      (address &&
                        lockAmount &&
                        VMOONEYLock?.[0] &&
                        parseFloat(lockAmount) >
                          parseFloat(
                            ethers.utils.formatEther(
                              VMOONEYLock?.[0]?.add(MOONEYBalance?.toString())
                            )
                          )) ||
                      !lockAmount
                        ? 'border-disabled btn-disabled bg-transparent'
                        : 'bg-primary'
                    }`}
                    isDisabled={
                      (!canIncrease.amount &&
                        !canIncrease.time &&
                        Number(lockAmount) <=
                          Number(VMOONEYLock?.[0].toString() / 10 ** 18)) ||
                      (!canIncrease.amount &&
                        !canIncrease.time &&
                        Date.parse(lockTime.formatted) <
                          Date.parse(
                            dateToReadable(bigNumberToDate(VMOONEYLock?.[1]))
                          ))
                    }
                    action={async () => {
                      //check for token allowance
                      const allowance = Number(formatEther(tokenAllowance))

                      const lockedMooney = Number(formatEther(VMOONEYLock?.[0]))

                      const increaseAmount =
                        lockedMooney <= 0
                          ? Number(lockAmount)
                          : Number(lockAmount) - lockedMooney

                      if (increaseAmount > allowance) {
                        const approvalTx = await approveToken()
                        approvalTx?.receipt &&
                          toast.success('Successfully approved MOONEY for lock')
                      }

                      const lockTx = hasLock
                        ? await increaseLock?.()
                        : await createLock?.()

                      lockTx?.receipt &&
                        toast.success(
                          hasLock
                            ? 'Successfully Increased lock'
                            : 'Successfully Created lock'
                        )
                    }}
                  >
                    {!hasLock
                      ? t('lock')
                      : `${t('lockInc')} ${
                          canIncrease.amount && !canIncrease.time
                            ? t('amount')
                            : ''
                        }  
                        ${
                          !canIncrease.amount && canIncrease.time
                            ? t('time')
                            : ''
                        }`}
                  </Web3Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="">{t('expDesc')}</p>
                <div className="card-actions mt-4">
                  <Web3Button contractAddress="" action={() => withdraw()}>
                    {t('withdraw')}
                  </Web3Button>
                </div>
              </div>
            )}
          </div>

          {/*Allowance Warning*/}
          <AllowanceWarning
            tokenContract={mooneyContract}
            spender={VMOONEY_ADDRESSES[selectedChain.slug]}
          />
        </div>
      </div>
    </main>
  )
}
