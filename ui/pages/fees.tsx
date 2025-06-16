import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import SectionCard from '@/components/layout/SectionCard'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  readContract,
  getContract,
} from 'thirdweb'
import {
  arbitrum,
  base,
  sepolia,
  arbitrumSepolia,
  Chain,
} from 'thirdweb/chains'
import client from '@/lib/thirdweb/client'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { ethers } from 'ethers'

export default function Fees() {
  const account = useActiveAccount()
  const address = account?.address

  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains: Chain[] = isTestnet
    ? [arbitrumSepolia, sepolia]
    : [arbitrum, base]

  const { isMobile } = useWindowSize()
  const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const WEEK = 7 * 24 * 60 * 60

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [canDistribute, setCanDistribute] = useState(false)
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const [feesAvailable, setFeesAvailable] = useState<string | null>(null)
  const [feeData, setFeeData] = useState<any[]>([])

  useEffect(() => {
    const fetchStatus = async () => {
      if (!address) return

      try {
        const results: any[] = []
        for (const chain of chains) {
          const slug = getChainSlug(chain)
          const hookAddress = FEE_HOOK_ADDRESSES[slug]
          if (!hookAddress) continue
          const contract = getContract({
            client,
            address: hookAddress,
            abi: FeeHook.abi,
            chain,
          })

          const start = await readContract({
            contract,
            method: 'weekStart' as string,
            params: [],
          })

          const last = await readContract({
            contract,
            method: 'lastCheckIn' as string,
            params: [address],
          })

          const count = await readContract({
            contract,
            method: 'getCheckedInCount' as string,
            params: [],
          })

          const balance = await readContract({
            contract,
            method: 'balanceOf' as string,
            params: [],
          })

          results.push({ chain, slug, contract, start, last, count, balance })
        }

        setFeeData(results)

        let totalFees = BigNumber.from(0)
        let allChecked = true
        let totalCount = 0
        let distribute = false
        const now = Math.floor(Date.now() / 1000)

        for (const r of results) {
          totalFees = totalFees.add(BigNumber.from(r.balance || 0))
          totalCount += r.count ? Number(r.count) : 0
          if (BigNumber.from(r.balance || 0).gt(0)) {
            if (!BigNumber.from(r.last).eq(BigNumber.from(r.start))) {
              allChecked = false
            }
          }
          if (
            BigNumber.from(r.start).add(WEEK).toNumber() <= now &&
            BigNumber.from(r.balance || 0).gt(0)
          ) {
            distribute = true
          }
        }

        setFeesAvailable(ethers.utils.formatEther(totalFees))
        setCheckedInCount(totalCount)
        setIsCheckedIn(allChecked)
        setCanDistribute(distribute)
      } catch (error) {
        console.error('Error fetching fee status:', error)
      }
    }
    fetchStatus()
  }, [address, isCheckedIn])

  const handleCheckIn = async () => {
    try {
      if (!account) throw new Error('No account found')
      for (const data of feeData) {
        if (BigNumber.from(data.balance || 0).gt(0)) {
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
      toast.success('Checked in!', { style: toastStyle })
      setIsCheckedIn(true)
    } catch (error) {
      console.error('Error checking in:', error)
      toast.error('Error checking in. Please try again.', { style: toastStyle })
    }
  }

  const handleDistributeFees = async () => {
    try {
      if (!account) throw new Error('No account found')
      for (const data of feeData) {
        if (BigNumber.from(data.balance || 0).gt(0)) {
          const tx = prepareContractCall({
            contract: data.contract,
            method: 'distributeFees' as string,
            params: [],
          })
          await sendAndConfirmTransaction({
            transaction: tx,
            account,
          })
        }
      }
      toast.success('Fees distributed!', { style: toastStyle })
      setCanDistribute(false)
    } catch (error) {
      console.error('Error distributing fees:', error)
      toast.error('Error distributing fees. Please try again.', {
        style: toastStyle,
      })
    }
  }

  return (
    <>
      <WebsiteHead
        title={'Liquidity Rewards'}
        description={'Check in weekly and distribute accrued fees.'}
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={'Liquidity Rewards'}
            headerSize="max(20px, 3vw)"
            description={'Get liquidity rewards by checking in weekly.'}
            preFooter={<NoticeFooter />}
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <SectionCard>
              <div className="mt-3 w-[25vw] flex flex-col gap-4">
                <div className="mb-2">
                  <div className="text-xl font-GoodTimes opacity-80">
                    Rewards This Week :
                  </div>
                  <Asset
                    name="ETH"
                    amount={
                      feesAvailable !== null ? feesAvailable : 'Loading...'
                    }
                    usd={
                      feesAvailable !== null && ethPrice
                        ? (Number(feesAvailable) * ethPrice).toFixed(2)
                        : 'Loading...'
                    }
                  />
                  <div className="mt-4 opacity-75">
                    {checkedInCount !== null
                      ? checkedInCount > 0
                        ? checkedInCount === 1
                          ? '1 person has checked in this week!'
                          : `${checkedInCount} people have checked in this week!`
                        : 'No one has checked in yet!'
                      : 'Loading...'}
                  </div>
                </div>
                <PrivyWeb3Button
                  action={handleCheckIn}
                  label={isCheckedIn ? 'Checked In' : 'Check In'}
                  className="w-full max-w-[250px] rounded-[5vmax] rounded-tl-[20px]"
                  isDisabled={!address || isCheckedIn}
                />
                <PrivyWeb3Button
                  action={handleDistributeFees}
                  label="Distribute Fees"
                  className="w-full max-w-[250px] rounded-[5vmax] rounded-tl-[20px]"
                  isDisabled={!canDistribute}
                />
              </div>
            </SectionCard>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
