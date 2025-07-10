import { useWallets } from '@privy-io/react-auth'
import FeeHook from 'const/abis/FeeHook.json'
import ERC20 from '../const/abis/ERC20.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import React, { useState, useEffect, useContext } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  readContract,
  simulateTransaction,
  getContract,
} from 'thirdweb'
import {
  arbitrum,
  base,
  sepolia,
  arbitrumSepolia,
  Chain,
} from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { SolarConfetti } from '@/components/assets'

export default function Fees() {
  const account = useActiveAccount()
  const address = account?.address

  const { wallets } = useWallets()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains: Chain[] = isTestnet
    ? [sepolia, arbitrumSepolia]
    : [arbitrum, base]

  const { isMobile } = useWindowSize()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const WEEK = 7 * 24 * 60 * 60

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const { selectedWallet } = useContext(PrivyWalletContext)

  type FeeData = {
    chain: string
    slug: string
    balance: BigNumber
    count: number
    checkedInOnChain: boolean
    contract: any
  }

  function useFeeData(address?: string) {
    const [data, setData] = useState<FeeData[]>([])

    useEffect(() => {
      if (!address) {
        setData([])
        return
      }

      let cancelled = false
      ;(async () => {
        const results = await Promise.all(
          chains.map(async (chain) => {
            const slug = getChainSlug(chain)
            const hookAddr = FEE_HOOK_ADDRESSES[slug]
            if (!hookAddr) return null

            const contract = getContract({
              client,
              address: hookAddr,
              abi: FeeHook.abi,
              chain,
            })
            const [start, last, count, balance] = await Promise.all([
              readContract({ contract, method: 'weekStart', params: [] }),
              readContract({
                contract,
                method: 'lastCheckIn',
                params: [address],
              }),
              readContract({
                contract,
                method: 'getCheckedInCount',
                params: [],
              }),
              readContract({ contract, method: 'balanceOf', params: [] }),
            ])

            //const count = countBn.toNumber()
            const checkedInOnChain = BigNumber.from(last).eq(
              BigNumber.from(start)
            )

            return {
              chain,
              slug,
              balance: BigNumber.from(balance),
              count,
              checkedInOnChain,
              contract,
            }
          })
        )

        if (!cancelled) {
          setData(results.filter((r): r is FeeData => !!r))
        }
      })()

      return () => {
        cancelled = true
      }
    }, [address])

    return data
  }

  function useFeeSummary(feeData: FeeData[]) {
    const [totalFees, setTotalFees] = useState<BigNumber>(0)
    const [checkedInCount, setCheckedInCount] = useState(0)
    const [allChecked, setAllChecked] = useState(false)

    useEffect(() => {
      let fees = 0
      let count = 0
      let checked = true

      for (const { balance, count: c, checkedInOnChain } of feeData) {
        fees += balance
        count += Number(c)
        if (balance.gt(0) && !checkedInOnChain) checked = false
      }

      setTotalFees(fees)
      setCheckedInCount(count)
      setAllChecked(checked)
    }, [feeData])

    return { totalFees, checkedInCount, allChecked }
  }

  function useEstimatedReward(
    feeData: FeeData[],
    totalFees: BigNumber,
    userAddr?: string
  ) {
    const [reward, setReward] = useState('0')

    useEffect(() => {
      if (!userAddr || !totalFees) {
        setReward('0')
        return
      }

      let cancelled = false
      ;(async () => {
        let totalVM = 0
        let userVM = 0

        await Promise.all(
          feeData.map(async ({ slug, chain, count }) => {
            const hookAddr = FEE_HOOK_ADDRESSES[slug]!
            const hookContract = getContract({
              client,
              address: hookAddr,
              abi: FeeHook.abi,
              chain,
            })
            const vMooneyAddr = (await readContract({
              contract: hookContract,
              method: 'vMooneyAddress',
              params: [],
            })) as string

            const tokenContract = getContract({
              client,
              address: vMooneyAddr,
              abi: ERC20,
              chain,
            })
            // fetch all checked-in addresses balances in parallel
            const balances = await Promise.all(
              Array.from({ length: Number(count) }, (_, i) =>
                readContract({
                  contract: hookContract,
                  method: 'checkedIn',
                  params: [i],
                }).then(async (addr) => {
                  return {
                    address: addr,
                    balance: await readContract({
                      contract: tokenContract,
                      method: 'balanceOf',
                      params: [addr],
                    }),
                  }
                })
              )
            )

            for (const b of balances) {
              totalVM += Number(b.balance)
              // @ts-ignore
              if (b.address?.toLowerCase() === userAddr.toLowerCase()) {
                userVM += Number(b.balance)
              }
            }
          })
        )

        if (!cancelled && totalVM) {
          const est = totalFees * (userVM / totalVM)
          setReward(ethers.utils.formatEther(est.toString()))
        }
      })()

      return () => {
        cancelled = true
      }
    }, [feeData, totalFees, userAddr])

    return reward
  }
  const feeData = useFeeData(address)

  // In your component:
  const { totalFees, checkedInCount, allChecked } = useFeeSummary(feeData)
  const estimatedReward = useEstimatedReward(feeData, totalFees, address)

  useEffect(() => {
    if (estimatedReward && Number(estimatedReward) > 0) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [estimatedReward])

  const handleDistribute = async () => {
    try {
      if (!account) throw new Error('No account found')
      const currentChain = selectedChain
      for (const data of feeData) {
        if (BigNumber.from(data.balance || 0).gt(0)) {
          if (selectedChain.id !== data.chain.id) {
            setSelectedChain(data.chain)
          }
          const tx = prepareContractCall({
            contract: data.contract,
            method: 'distributeFees' as string,
            params: [],
          })
          const results = await simulateTransaction({
            transaction: tx,
            account,
          })
        }
      }
      setSelectedChain(currentChain)
      toast.success('Fees distributed!', { style: toastStyle })
    } catch (error) {
      console.error('Error distributing fees:', error)
      toast.error('Error distributing fees. Please try again.', {
        style: toastStyle,
      })
    }
  }

  const handleCheckIn = async () => {
    try {
      if (!account) throw new Error('No account found')
      const currentChain = selectedChain
      for (const data of feeData) {
        if (data.checkedInOnChain) continue
        if (BigNumber.from(data.balance || 0).gt(0)) {
          if (selectedChain.id !== data.chain.id) {
            setSelectedChain(data.chain)
          }
          const tx = prepareContractCall({
            contract: data.contract,
            method: 'checkIn' as string,
            params: [],
          })
          await sendAndConfirmTransaction({
            transaction: tx,
            account,
          })
        }
      }
      setSelectedChain(currentChain)
      toast.success('Checked in!', { style: toastStyle })
      setIsCheckedIn(true)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 5000)
    } catch (error) {
      console.error('Error checking in:', error)
      toast.error('Error checking in. Please try again.', { style: toastStyle })
    }
  }

  return (
    <>
      <WebsiteHead
        title={'Liquidity Rewards'}
        description={
          'Check in weekly and distribute accrued fees. To check in you will need to sign one transaction per chain.'
        }
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={'Liquidity Rewards'}
            headerSize="max(20px, 3vw)"
            description={'Get liquidity rewards by checking in weekly.'}
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
            {showConfetti && (
              <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
                <SolarConfetti />
              </div>
            )}
            <SectionCard>
              <div>
                <p>
                  Total fees available: {ethers.utils.formatEther(totalFees)}
                </p>
                <p>Checked-in count: {checkedInCount}</p>
                <p>All chains checked this week? {allChecked ? '✅' : '❌'}</p>
                <p>Estimated reward for you: {estimatedReward}</p>
              </div>
              <div className="mt-3 w-full max-w-md mx-auto flex flex-col gap-4">
                <div className="mb-2">
                  <div className="text-xl font-GoodTimes opacity-80">
                    Rewards This Week:
                  </div>
                  <Asset
                    name="ETH"
                    amount={
                      totalFees !== null
                        ? Number(ethers.utils.formatEther(totalFees)).toFixed(4)
                        : 'Loading...'
                    }
                    usd={
                      totalFees !== null && ethPrice
                        ? (
                            Number(ethers.utils.formatEther(totalFees)) *
                            ethPrice
                          ).toFixed(2)
                        : 'Loading...'
                    }
                  />
                  {totalFees !== null && Number(totalFees) > 0 && (
                    <div className="mt-4 opacity-75">
                      {checkedInCount !== null
                        ? checkedInCount > 0
                          ? checkedInCount === 1
                            ? '1 check in this week!'
                            : `${checkedInCount} check ins this week!`
                          : 'No one has checked in yet!'
                        : 'Loading...'}
                    </div>
                  )}
                </div>
                {estimatedReward !== null && (
                  <div className="text-center text-white/90 font-semibold mt-2">
                    Your Estimated Reward: {Number(estimatedReward).toFixed(6)}{' '}
                    ETH
                  </div>
                )}
                {totalFees !== null &&
                  Number(totalFees) > 0 &&
                  !isCheckedIn && (
                    <PrivyWeb3Button
                      action={handleCheckIn}
                      label={isCheckedIn ? 'Checked In' : 'Check In'}
                      className="w-full max-w-[250px] rounded-[5vmax] rounded-tl-[20px]"
                      isDisabled={!address || isCheckedIn}
                    />
                  )}
                <PrivyWeb3Button
                  action={handleDistribute}
                  label="Distribute Fees"
                  className="w-full max-w-[250px] rounded-[5vmax] rounded-tl-[20px]"
                  //isDisabled={!address || isCheckedIn || totalFees === null}
                />
              </div>
            </SectionCard>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
