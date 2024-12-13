import { useFundWallet } from '@privy-io/react-auth'
import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
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
  calculateVMOONEY,
} from '../lib/tokens/ve-token'
import { bigNumberToDate, dateOut, dateToReadable } from '../lib/utils/dates'
import { NumberType, transformNumber } from '../lib/utils/numbers'
import viemChains from '@/lib/viem/viemChains'
import Balance from '../components/Balance'
import TimeRange from '../components/TimeRange'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import Head from '../components/layout/Head'
import { LockData } from '../components/lock/LockData'
import { PrivyWeb3Button } from '../components/privy/PrivyWeb3Button'
import { AllowanceWarning } from '../components/thirdweb/AllowanceWarning'
import LockPresets from '../components/thirdweb/LockPresets'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import ERC20ABI from '../const/abis/ERC20.json'
import VotingEscrow from '../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../const/config'

export default function Lock() {
  const router = useRouter()
  const { selectedChain }: any = useContext(ChainContext)
  const address = useAddress()
  const sdk = useSDK()

  const { fundWallet } = useFundWallet()

  // get mooney contract (useContract assigns wrong abi for proxy)
  const [mooneyContract, setMooneyContract] = useState()
  useEffect(() => {
    if (selectedChain?.slug && sdk) {
      sdk
        .getContract(MOONEY_ADDRESSES[selectedChain?.slug], ERC20ABI.abi)
        .then((contract: any) => {
          setMooneyContract(contract)
        })
    }
  }, [selectedChain?.slug, sdk])

  const { contract: vMooneyContract }: any = useContract(
    VMOONEY_ADDRESSES[selectedChain?.slug],
    VotingEscrow.abi
  )

  const { data: MOONEYBalance, isLoading: MOONEYBalanceLoading } =
    useMOONEYBalance(mooneyContract, address || '')
  const { data: VMOONEYBalance, isLoading: VMOONEYBalanceLoading } =
    useVMOONEYBalance(vMooneyContract, address)

  const { data: VMOONEYLock, isLoading: VMOONEYLockLoading } = useVMOONEYLock(
    vMooneyContract,
    address
  )

  const [hasExpired, setHasExpired] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasExpired(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          ethers.BigNumber.from(+new Date()).gte(VMOONEYLock[1].mul(1000))
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address])

  const [lockAmount, setLockAmount] = useState<string>('0')
  //reset lock amount on chain switch
  useEffect(() => {
    setLockAmount('0')
  }, [selectedChain])

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
    ethers.utils.parseEther(lockAmount || '0'),
    VMOONEYLock?.[0],
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address,
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { mutateAsync: createLock } = useVMOONEYCreateLock(
    vMooneyContract,
    lockAmount && ethers.utils.parseEther(lockAmount),
    lockTime?.value.div(1000)
  )

  const [hasLock, setHasLock] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading && setHasLock(VMOONEYLock && VMOONEYLock[0] != 0)
  }, [VMOONEYLock, VMOONEYLockLoading, address, createLock])

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
  }, [hasLock, VMOONEYLock, selectedChain, address])

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
  }, [hasLock, lockAmount, lockTime, VMOONEYLock, address])

  const { t } = useTranslation('common')

  return (
    <Container>
      <ContentLayout
        header="Lock $MOONEY"
        description={
          <p>
            {'Playing an active role in MoonDAO governance is simple: '}
            <button
              className="underline"
              onClick={() => {
                if (!address) return toast.error('Please connect your wallet')
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
            {', our governance token, and '}
            <button
              className="underline"
              onClick={() => {
                router.push('/lock')
              }}
            >
              {'lock for voting power'}
            </button>
            {'.  '}
          </p>
        }
        isProfile
        headerSize="max(20px, 2vw)"
        mode="compact"
        mainPadding
        preFooter={<NoticeFooter />}
      >
        <main className="animate-fadeIn font-RobotoMono">
          <Head title="Voting Power" />
          <div className="mt-3 w-full">
            <LockData
              hasLock={hasLock}
              VMOONEYBalance={VMOONEYBalance}
              VMOONEYBalanceLoading={VMOONEYBalanceLoading}
              VMOONEYLock={VMOONEYLock}
              VMOONEYLockLoading={VMOONEYLockLoading}
            />

            <div className="my-7 lg:my-5 justify-center xl:mt-8 flex xl:w-3/4 lg:justify-normal">
              <NetworkSelector />
            </div>
            {/*Available to Lock*/}
            {!hasExpired && (
              <div className="xl:w-3/4 rounded-md text-xs sm:tracking-wide lg:text-base uppercase font-semibold xl:text-xl bg-dark-cool rounded-[20px] overflow-hidden px-2 py-3 lg:px-5 lg:py-4 flex items-center">
                <p className="text-slate-900 dark:text-white">
                  {t('lockAvailableMoney')}{' '}
                </p>
                <Balance
                  balance={MOONEYBalance?.toString() / 10 ** 18}
                  loading={MOONEYBalanceLoading}
                />
              </div>
            )}
            {/*Locking Section*/}
            <div className="mt-5 py-5 xl:w-3/4 bg-dark-cool rounded-[20px] overflow-hidden px-6 rounded-md">
              <div className="flex flex-col">
                {!hasExpired ? (
                  <div>
                    {/*Lock Amount label*/}
                    <label className="block">
                      <p className="uppercase font-semibold title-text-colors">
                        {t('lockAmount')}
                      </p>
                      <p
                        className={`tracking-wider text-sm text-light-text dark:text-white mt-3 ${
                          hasLock && canIncrease.time ? 'animate-highlight' : ''
                        }`}
                      >
                        {t('lockAmountDesc')}
                        {hasLock && canIncrease.time ? t('lockAmountNote') : ''}
                      </p>
                    </label>

                    {/*Input for Lock amount*/}
                    <div className="mt-4 flex items-center justify-between pl-6 h-[37px] rounded-xl overflow-hidden border border-[#CBE4F7]">
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full dark:[color-scheme:dark] pl-2 py-1 text-title-light dark:text-title-dark dark:bg-[#071732] truncate tracking-wide"
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
                        className="w-[80px] bg-[#CBE4F7] text-[18px] text-[#1F212B] uppercase h-full"
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
                    <label className="mt-6 xl:mt-10 block">
                      <p className="uppercase font-semibold title-text-colors">
                        {t('lockExpDate')}
                      </p>
                      <p className="tracking-wider text-sm text-light-text dark:text-white mt-3">
                        {t('lockDesc2')}
                        {hasLock && canIncrease.amount
                          ? t('lockAmountNote')
                          : ''}
                      </p>
                    </label>

                    {/*Date input for Lock expiration date*/}
                    <input
                      type="date"
                      placeholder={t('lockExpDate')}
                      className="mt-4 input input-bordered w-full dark:[color-scheme:dark] dark:bg-[#071732] text-black dark:text-white border dark:border-white"
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
                          <span className=" text-white font-bold text-base inline-block">
                            {calculateVMOONEY({
                              CurrentMOONEYLock: ethers.utils.formatEther(
                                VMOONEYLock?.[0] || 0
                              ),
                              MOONEYAmount:
                                +lockAmount ||
                                ethers.utils.formatEther(VMOONEYLock?.[0] || 0),
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
                      <div className="rounded-[20px] rounded-tl-[10px] overflow-hidden">
                        <PrivyWeb3Button
                          label={
                            !hasLock
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
                            }`
                          }
                          action={async () => {
                            //check for token allowance

                            const lockAmountBigNum =
                              ethers.utils.parseEther(lockAmount)

                            const increaseAmount = VMOONEYLock?.[0]
                              ? lockAmountBigNum.sub(VMOONEYLock?.[0])
                              : lockAmountBigNum

                            if (increaseAmount.gt(tokenAllowance)) {
                              const approvalTx: any = await approveToken()
                              approvalTx?.receipt &&
                                toast.success(
                                  'Successfully approved MOONEY for lock'
                                )
                            }

                            const lockTx: any = hasLock
                              ? await increaseLock?.()
                              : await createLock?.()

                            lockTx?.receipt &&
                              toast.success(
                                hasLock
                                  ? 'Successfully Increased lock'
                                  : 'Successfully Created lock'
                              )
                          }}
                          className={`hover:!text-title-light 
                          bg-slate-300
                          dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
                          isDisabled={
                            (!canIncrease.amount &&
                              !canIncrease.time &&
                              Number(lockAmount) <=
                                Number(
                                  VMOONEYLock?.[0].toString() / 10 ** 18
                                )) ||
                            (!canIncrease.amount &&
                              !canIncrease.time &&
                              Date.parse(lockTime?.formatted) <
                                Date.parse(
                                  dateToReadable(
                                    bigNumberToDate(VMOONEYLock?.[1])
                                  )
                                ))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-light-text dark:text-dark-text">
                      {t('expDesc')}
                    </p>
                    <div className="card-actions mt-4">
                      <PrivyWeb3Button
                        label={t('withdraw')}
                        className={`hover:!text-title-light 
                        bg-slate-300
                        dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
                        action={withdraw}
                      />
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
      </ContentLayout>
    </Container>
  )
}
