import { useWallets } from '@privy-io/react-auth'
import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import React, { useState, useEffect, useContext } from 'react'
import toast from 'react-hot-toast'
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
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const [feesAvailable, setFeesAvailable] = useState<string | null>(null)
  const [estimatedFees, setEstimatedFees] = useState<string | null>(null)
  const [feeData, setFeeData] = useState<any[]>([])
  const { selectedWallet } = useContext(PrivyWalletContext)

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
            abi: FeeHook.abi as any,
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

          const checkedInOnChain = BigNumber.from(last).eq(
            BigNumber.from(start)
          )

          results.push({
            chain,
            slug,
            contract,
            start,
            last,
            count,
            balance,
            checkedInOnChain,
          })
        }

        setFeeData(results)

        let totalFees = BigNumber.from(0)
        let totalEstimated = BigNumber.from(0)
        let allChecked = true
        let totalCount = 0
        const now = Math.floor(Date.now() / 1000)

        for (const r of results) {
          totalFees = totalFees.add(BigNumber.from(r.balance || 0))
          totalCount += r.count ? Number(r.count) : 0
          if (BigNumber.from(r.balance || 0).gt(0)) {
            if (!BigNumber.from(r.last).eq(BigNumber.from(r.start))) {
              allChecked = false
            }
          }
          try {
            const estimate = await readContract({
              contract: r.contract,
              method: 'estimateFees' as string,
              params: [],
            })
            totalEstimated = totalEstimated.add(BigNumber.from(estimate || 0))
          } catch (err) {
            console.error('estimateFees failed', err)
          }
        }

        setFeesAvailable(ethers.utils.formatEther(totalFees))
        setEstimatedFees(ethers.utils.formatEther(totalEstimated))
        setCheckedInCount(totalCount)
        setIsCheckedIn(allChecked)
      } catch (error) {
        console.error('Error fetching fee status:', error)
      }
    }
    fetchStatus()
  }, [address, isCheckedIn, WEEK])

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
            <SectionCard>
              <div className="mt-3 w-[25vw] flex flex-col gap-4">
                <div className="mb-2">
                  <div className="text-xl font-GoodTimes opacity-80">
                    Rewards This Week:
                  </div>
                  <Asset
                    name="ETH"
                    amount={
                      feesAvailable !== null
                        ? Number(feesAvailable).toFixed(4)
                        : 'Loading...'
                    }
                    usd={
                      feesAvailable !== null && ethPrice
                        ? (Number(feesAvailable) * ethPrice).toFixed(2)
                        : 'Loading...'
                    }
                  />
                  {estimatedFees !== null && (
                    <div className="mt-4">
                      <div className="text-xl font-GoodTimes opacity-80">
                        Your Estimated Fees:
                      </div>
                      <Asset
                        name="ETH"
                        amount={Number(estimatedFees).toFixed(4)}
                        usd={
                          ethPrice
                            ? (Number(estimatedFees) * ethPrice).toFixed(2)
                            : '0'
                        }
                      />
                    </div>
                  )}
                  {feesAvailable !== null && Number(feesAvailable) > 0 && (
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
                {feesAvailable !== null &&
                  Number(feesAvailable) > 0 &&
                  !isCheckedIn && (
                    <PrivyWeb3Button
                      action={handleCheckIn}
                      label={isCheckedIn ? 'Checked In' : 'Check In'}
                      className="w-full max-w-[250px] rounded-[5vmax] rounded-tl-[20px]"
                      isDisabled={!address || isCheckedIn}
                    />
                  )}
              </div>
            </SectionCard>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
