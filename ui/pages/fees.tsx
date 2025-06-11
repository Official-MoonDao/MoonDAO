import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import React, { useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  readContract,
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

  const WEEK = 7 * 24 * 60 * 60

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [canDistribute, setCanDistribute] = useState(false)

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

        setIsCheckedIn(BigNumber.from(last).eq(BigNumber.from(start)))
        setCanDistribute(
          Math.floor(Date.now() / 1000) >=
            BigNumber.from(start).add(WEEK).toNumber()
        )
      } catch (error) {
        console.error('Error fetching fee status:', error)
      }
    }
    fetchStatus()
  }, [feeHookContract, address])

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
            description={'Manage weekly fee distribution.'}
            preFooter={<NoticeFooter />}
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <div className="mt-3 w-full flex flex-col gap-4">
              <PrivyWeb3Button
                action={handleCheckIn}
                label={isCheckedIn ? 'Checked In' : 'Check In'}
                className="rounded-[5vmax] rounded-tl-[20px]"
                isDisabled={!address || isCheckedIn}
              />
              <PrivyWeb3Button
                action={handleDistributeFees}
                label="Distribute Fees"
                className="rounded-[5vmax] rounded-tl-[20px]"
                isDisabled={!canDistribute}
              />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
