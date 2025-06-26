import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import React, { useContext, useState, useEffect } from 'react'
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
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { ethers } from 'ethers'

export default function Fees() {
  useChainDefault()

  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const feeHookContract = useContract({
    address: FEE_HOOK_ADDRESSES[chainSlug],
    abi: FeeHook.abi,
    chain: selectedChain,
  })
  const { isMobile } = useWindowSize()
  const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const WEEK = 7 * 24 * 60 * 60

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [canDistribute, setCanDistribute] = useState(false)
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const [feesAvailable, setFeesAvailable] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      if (!feeHookContract || !address) return

      try {
        const start = await readContract({
          contract: feeHookContract,
          method: 'weekStart' as string,
          params: [],
        })

        const last = await readContract({
          contract: feeHookContract,
          method: 'lastCheckIn' as string,
          params: [address],
        })

        const checkedInCount = await readContract({
          contract: feeHookContract,
          method: 'getCheckedInCount' as string,
          params: [],
        })

        const balance = await readContract({
          contract: feeHookContract,
          method: 'balanceOf' as string,
          params: [],
        })

        setIsCheckedIn(BigNumber.from(last).eq(BigNumber.from(start)))
        setCheckedInCount(checkedInCount ? Number(checkedInCount) : 0)
        setFeesAvailable(
          balance ? ethers.utils.formatEther(Number(balance)) : '0'
        )
        setCanDistribute(
          Math.floor(Date.now() / 1000) >=
            BigNumber.from(start).add(WEEK).toNumber()
        )
      } catch (error) {
        console.error('Error fetching fee status:', error)
      }
    }
    fetchStatus()
  }, [feeHookContract, address, isCheckedIn, WEEK])

  const handleCheckIn = async () => {
    try {
      if (!account) throw new Error('No account found')
      const tx = prepareContractCall({
        contract: feeHookContract,
        method: 'checkIn' as string,
        params: [],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction: tx,
        account,
      })
      if (receipt) {
        toast.success('Checked in!', { style: toastStyle })
        setIsCheckedIn(true)
      }
    } catch (error) {
      console.error('Error checking in:', error)
      toast.error('Error checking in. Please try again.', { style: toastStyle })
    }
  }

  const handleDistributeFees = async () => {
    try {
      if (!account) throw new Error('No account found')
      const tx = prepareContractCall({
        contract: feeHookContract,
        method: 'distributeFees' as string,
        params: [],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction: tx,
        account,
      })
      if (receipt) {
        toast.success('Fees distributed!', { style: toastStyle })
        setCanDistribute(false)
      }
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
