import { useWallets } from '@privy-io/react-auth'
import { usePrivy } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import ERC20ABI from 'const/abis/ERC20.json'
import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import { Line } from 'rc-progress'
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
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
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
  const { authenticated } = usePrivy()

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
  const [weekPercent, setWeekPercent] = useState<number>(0)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const VMOONEYBalance = useTotalVP(address || '')

  useEffect(() => {
    if (!address) return

    const fetchBalances = async () => {
      try {
        const totalFees = (
          await Promise.all(
            chains.map(async (chain) => {
              const slug = getChainSlug(chain)
              const hookAddress = FEE_HOOK_ADDRESSES[slug]
              if (!hookAddress) return BigNumber.from(0)
              const contract = getContract({
                client,
                address: hookAddress,
                abi: FeeHook.abi as any,
                chain,
              })
              const balance = await readContract({
                contract,
                method: 'balanceOf',
                params: [address],
              })
              return balance
            })
          )
        )
          .filter((bal) => bal !== undefined && bal !== null)
          .reduce(
            (acc, bal) => acc.add(bal || BigNumber.from(0)),
            BigNumber.from(0)
          )

        setFeesAvailable(
          ethers.utils.formatEther(totalFees || BigNumber.from(0))
        )
      } catch (e) {
        console.error('Error fetching balances:', e)
      }
    }

    fetchBalances()
  }, [address, chains, client, WEEK])

  useEffect(() => {
    if (!feeData.length) return
    const starts = feeData.map((d) => BigNumber.from(d.start).toNumber())
    const earliest = Math.min(...starts)
    const update = () => {
      const now = Math.floor(Date.now() / 1000)
      const percent = ((now - earliest) / WEEK) * 100
      setWeekPercent(Math.max(0, Math.min(100, percent)))
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [feeData, WEEK])

  useEffect(() => {
    if (!address) return

    const fetchEstimates = async () => {
      try {
        const totalEstimated = (
          await Promise.all(
            chains.map(async (chain) => {
              const slug = getChainSlug(chain)
              const hookAddress = FEE_HOOK_ADDRESSES[slug]
              if (!hookAddress) return BigNumber.from(0)

              const contract = getContract({
                client,
                address: hookAddress,
                abi: FeeHook.abi as any,
                chain,
              })
              return readContract({
                contract,
                method: 'estimateFees',
                params: [address],
              }).catch(() => BigNumber.from(0))
            })
          )
        ).reduce(
          (acc, est) => acc.add(est || BigNumber.from(0)),
          BigNumber.from(0)
        )

        setEstimatedFees(ethers.utils.formatEther(totalEstimated))
      } catch (e) {
        console.error('Error fetching estimates:', e)
      }
    }

    fetchEstimates()
  }, [address, chains, client, WEEK])

  useEffect(() => {
    if (!address) return

    const fetchStatus = async () => {
      try {
        const raw = await Promise.all(
          chains.map(async (chain) => {
            const slug = getChainSlug(chain)
            const hookAddress = FEE_HOOK_ADDRESSES[slug]
            if (!hookAddress) return null

            const contract = getContract({
              client,
              address: hookAddress,
              abi: FeeHook.abi as any,
              chain,
            })

            const [start, last, count, vMooneyAddress] = await Promise.all([
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
              readContract({
                contract,
                method: 'vMooneyAddress',
                params: [],
              }),
            ])
            const vMooneyContract = getContract({
              client,
              address: vMooneyAddress,
              abi: ERC20ABI as any,
              chain,
            })

            const vMooneyBalance = await readContract({
              contract: vMooneyContract,
              method: 'balanceOf',
              params: [address],
            })

            return {
              chain,
              slug,
              contract,
              start,
              last,
              count,
              vMooneyBalance,
              checkedInOnChain: BigNumber.from(last).eq(BigNumber.from(start)),
            }
          })
        )

        const results = raw.filter((r) => r) as Array<{
          chain: any
          slug: string
          contract: any
          start: BigNumber
          last: BigNumber
          count: BigNumber
          checkedInOnChain: boolean
        }>

        setFeeData(results)

        // aggregate counts & allChecked
        const { totalCount, allChecked } = results.reduce(
          (acc, { last, start, count }) => {
            acc.totalCount += Number(count || 0)
            if (!BigNumber.from(last).eq(BigNumber.from(start))) {
              acc.allChecked = false
            }
            return acc
          },
          { totalCount: 0, allChecked: true }
        )

        setCheckedInCount(totalCount)
        setIsCheckedIn(allChecked)
      } catch (err) {
        console.error('Error fetching check‑in status:', err)
      }
    }

    fetchStatus()
  }, [address, chains, client, WEEK])

  const handleCheckIn = async () => {
    try {
      if (!account) throw new Error('No account found')
      const currentChain = selectedChain
      for (const data of feeData) {
        if (data.checkedInOnChain) continue
        if (!data.vMooneyBalance || BigNumber.from(data.vMooneyBalance).eq(0)) {
          continue
        }
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
      setSelectedChain(currentChain)
      toast.success('Checked in!', { style: toastStyle })
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })
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
              {!authenticated ? (
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-4">
                    Please Connect Your Wallet to check in.
                  </h1>
                </div>
              ) : !VMOONEYBalance > 0 ? (
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-4">
                    Get vMOONEY to collect rewards!
                    <PrivyWeb3Button
                      v5
                      requiredChain={DEFAULT_CHAIN_V5}
                      label="Get vMOONEY`"
                      action={() => router.push('/lock')}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                    />
                  </h1>
                </div>
              ) : (
                <div className="mt-3 w-[25vw] flex flex-col gap-4">
                  <div className="mb-2">
                    <div className="text-xl font-GoodTimes opacity-80">
                      Total Weekly Rewards:
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
                          Your Estimated Rewards:
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
                    {weekPercent >= 0 && (
                      <div className="mt-4">
                        <Line
                          percent={weekPercent}
                          strokeWidth={4}
                          strokeColor="#D7594F"
                          trailColor="#D7594F2B"
                        />
                        <div className="text-sm text-center mt-1 opacity-75">
                          {weekPercent.toFixed(1)}% of week passed
                        </div>
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
              )}
            </SectionCard>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
