import {
  MoonIcon,
  LockClosedIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { Web3Button, useAddress, useContract } from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import { useEffect, useState } from 'react'
import React from 'react'
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
import GradientLink from '../components/layout/GradientLink'
import Head from '../components/layout/Head'
import MainCard from '../components/layout/MainCard'
import L2Toggle from '../components/lock/L2Toggle'
import { AllowanceWarning } from '../components/thirdweb/AllowanceWarning'
import LockPresets from '../components/thirdweb/LockPresets'
import ERC20ABI from '../const/abis/ERC20.json'
import VotingEscrow from '../const/abis/VotingEscrow.json'
import useContractConfig from '../const/config'

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

  const { MOONEYToken, vMOONEYToken } = useContractConfig()

  const { contract: vMooneyContract } = useContract(
    vMOONEYToken,
    VotingEscrow.abi
  )

  const { contract: mooneyContract } = useContract(MOONEYToken, ERC20ABI.abi)

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

  const [lockAmount, setLockAmount] = useState<string>()

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
    BigNumber.from(Number(lockAmount || 0).toFixed(0)),
    vMOONEYToken
  )

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address || '',
    vMOONEYToken
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
    <div className="animate-fadeIn">
      <Head title="$vMOONEY" />
      <MainCard title={t('lockCardTitle')}>
        <div>
          <L2Toggle />
        </div>
        <p className="mb-4">
          {t('lockTitle')}{' '}
          <GradientLink
            text={t('learnMore')}
            href="https://docs.moondao.com/token/#vmooney-characteristics"
          ></GradientLink>
        </p>
        {!hasLock ? (
          <>
            <p>
              {t('lockDesc')}
              <br />
              <br />
            </p>
          </>
        ) : (
          ''
        )}
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

        <div className="card bg-base-100 rounded-[15px] border-[0.5px] border-gray-300 backdropBlur bg-transparent bg-opacity-30 shadow-indigo-40 text-white shadow overflow-visible">
          <div className="card-body">
            <div className="form-control">
              {!hasExpired ? (
                <>
                  <p className="mb-4">
                    {t('lockAvailableMoney')}{' '}
                    <Balance
                      balance={MOONEYBalance?.toString() / 10 ** 18}
                      loading={MOONEYBalanceLoading}
                    />{' '}
                    $MOONEY
                  </p>
                  <label className="label">
                    <span className="label-text white-text">
                      {t('lockAmount')}
                      <br />
                      <span
                        className={
                          hasLock && canIncrease.time ? 'animate-highlight' : ''
                        }
                      >
                        {t('lockAmountDesc')}
                        {hasLock && canIncrease.time ? t('lockAmountNote') : ''}
                      </span>
                    </span>
                  </label>
                  <div className="input-group mb-4 black-text">
                    <input
                      type="number"
                      placeholder="0"
                      className="input input-bordered w-full"
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

                    <button
                      className="btn btn-outline white-text hover:bg-accent"
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
                            : ((+MOONEYBalance?.toString() / 10 ** 18) as any)
                        )
                        setWantsToIncrease(true)
                      }}
                    >
                      Max
                    </button>
                  </div>
                  <label className="label">
                    <span className="label-text white-text">
                      {t('lockExpDate')}
                      <br />
                      <span className="text-xs">
                        {t('lockDesc2')}
                        {hasLock && canIncrease.amount
                          ? t('lockAmountNote')
                          : ''}
                      </span>
                    </span>
                  </label>
                  <input
                    type="date"
                    placeholder={t('lockExpDate')}
                    className="input input-bordered w-full black-text"
                    value={lockTime?.formatted || 0}
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

                  <TimeRange
                    disabled={
                      !address ||
                      +MOONEYBalance?.toString() === 0 ||
                      (hasLock && canIncrease.amount)
                        ? true
                        : false
                    }
                    time={Date.parse(lockTime.formatted)}
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
                  {(canIncrease.time || canIncrease.amount) &&
                  wantsToIncrease ? (
                    <p>
                      {t('lockBalance')}{' '}
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
                    </p>
                  ) : (
                    ''
                  )}
                  <div className="card-actions mt-4 white-text">
                    <Web3Button
                      contractAddress={vMOONEYToken}
                      className={`border-style btn text-black normal-case font-medium w-full ${
                        (hasLock &&
                          ((canIncrease.amount && canIncrease.time) ||
                            (!canIncrease.amount && !canIncrease.time))) ||
                        (address &&
                          lockAmount &&
                          parseFloat(lockAmount) >
                            parseFloat(
                              ethers.utils.formatEther(
                                VMOONEYLock?.[0].add(
                                  MOONEYBalance?.toString()
                                ) || 0
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
                        const lockedMooney = Number(
                          formatEther(VMOONEYLock?.[0])
                        )
                        const increaseAmount =
                          lockedMooney <= 0
                            ? Number(lockAmount)
                            : Number(lockAmount) - lockedMooney

                        if (increaseAmount > allowance) {
                          await approveToken()
                        }
                        const tx = hasLock
                          ? await increaseLock?.()
                          : await createLock?.()
                        console.log(tx)
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
                </>
              ) : (
                <>
                  <p className="white-text">{t('expDesc')} </p>

                  <div className="card-actions mt-4">
                    <Web3Button contractAddress="" action={() => withdraw()}>
                      {t('withdraw')}
                    </Web3Button>
                  </div>
                </>
              )}
            </div>
            <AllowanceWarning
              tokenContract={mooneyContract}
              spender={vMOONEYToken}
            />
          </div>
        </div>
      </MainCard>
    </div>
  )
}
