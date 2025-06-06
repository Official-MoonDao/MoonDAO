import FeeHook from 'const/abis/FeeHook.json'
import VotingEscrow from 'const/abis/VotingEscrow.json'
import ERC20 from 'const/abis/ERC20.json'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import {
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
  VOTING_ESCROW_DEPOSITOR_ADDRESSES,
  FEE_HOOK_ADDRESSES,
  MOONEY_DECIMALS,
  DEFAULT_CHAIN_V5,
} from 'const/config'

const ETH_DECIMALS = 18
import { BigNumber, ethers } from 'ethers'

const INFURA_KEY = '357d367444db45688746488a06064e7c'
const CROSS_CHAIN_VMOONEY = [
  {
    rpc: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    address: '0xCc71C80d803381FD6Ee984FAff408f8501DB1740',
  },
  {
    rpc: `https://arbitrum-mainnet.infura.io/v3/${INFURA_KEY}`,
    address: '0xB255c74F8576f18357cE6184DA033c6d93C71899',
  },
  {
    rpc: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
    address: '0xe2d1BFef0A642B717d294711356b468ccE68BEa6',
  },
  {
    rpc: `https://base-mainnet.infura.io/v3/${INFURA_KEY}`,
    address: '0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBAcF5',
  },
]

const ERC20_MIN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]
import { useRouter } from 'next/router'
import React, { useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { approveToken } from '@/lib/tokens/approve'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import StandardButton from '../components/layout/StandardButton'
import Asset from '@/components/dashboard/treasury/balance/Asset'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'

export default function Withdraw() {
  useChainDefault()
  const router = useRouter()

  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  //Contracts
  const votingEscrowDepositorContract = useContract({
    address: VOTING_ESCROW_DEPOSITOR_ADDRESSES[chainSlug],
    abi: VotingEscrowDepositor.abi,
    chain: selectedChain,
  })

  const feeHookContract = useContract({
    address: FEE_HOOK_ADDRESSES[chainSlug],
    abi: FeeHook.abi,
    chain: selectedChain,
  })
  console.log('FeeHOOK abi', FeeHook.abi)
  console.log('FeeHOOK address', FEE_HOOK_ADDRESSES[chainSlug])
  const vMooneyContract = useContract({
    address: VMOONEY_ADDRESSES[chainSlug],
    abi: VotingEscrow,
    chain: selectedChain,
  })
  const mooneyContract = useContract({
    address: MOONEY_ADDRESSES[chainSlug],
    abi: ERC20,
    chain: selectedChain,
  })

  const { data: balanceTimeWeighted } = useRead({
    contract: feeHookContract,
    method: 'balanceTimeWeighted' as string,
    params: [address],
  })

  const { data: supplyTimeWeighted } = useRead({
    contract: feeHookContract,
    method: 'supplyTimeWeighted' as string,
    params: [],
  })

  const { data: totalReceived } = useRead({
    contract: feeHookContract,
    method: 'totalReceived' as string,
    params: [],
  })

  const { data: lastSupplyUpdate } = useRead({
    contract: feeHookContract,
    method: 'lastSupplyUpdate' as string,
    params: [],
  })

  const { data: lastBalanceUpdate } = useRead({
    contract: feeHookContract,
    method: 'lastBalanceUpdate' as string,
    params: [address],
  })

  const { data: totalWithdrawnPerUser } = useRead({
    contract: feeHookContract,
    method: 'totalWithdrawnPerUser' as string,
    params: [address],
  })

  const [withdrawableFees, setWithdrawableFees] = useState<BigNumber>(BigNumber.from(0))

  useEffect(() => {
    async function calculateWithdrawable() {
      if (
        balanceTimeWeighted === undefined ||
        supplyTimeWeighted === undefined ||
        totalReceived === undefined ||
        totalWithdrawnPerUser === undefined ||
        lastBalanceUpdate === undefined ||
        lastSupplyUpdate === undefined ||
        !address
      )
        return

      try {
        let totalSupplySum = BigNumber.from(0)
        let userBalanceSum = BigNumber.from(0)

        await Promise.all(
          CROSS_CHAIN_VMOONEY.map(async (c) => {
            const provider = new ethers.providers.JsonRpcProvider(c.rpc)
            const contract = new ethers.Contract(c.address, ERC20_MIN_ABI, provider)
            const [supply, balance] = await Promise.all([
              contract.totalSupply(),
              contract.balanceOf(address),
            ])
            totalSupplySum = totalSupplySum.add(BigNumber.from(supply))
            userBalanceSum = userBalanceSum.add(BigNumber.from(balance))
          })
        )

        const ts = Math.floor(Date.now() / 1000)
        const updatedSupplyTimeWeighted = BigNumber.from(supplyTimeWeighted).add(
          BigNumber.from(totalSupplySum).mul(ts - Number(lastSupplyUpdate))
        )
        const updatedBalanceTimeWeighted = BigNumber.from(balanceTimeWeighted).add(
          BigNumber.from(userBalanceSum).mul(ts - Number(lastBalanceUpdate))
        )

        if (updatedSupplyTimeWeighted.gt(0)) {
          const userProportion = updatedBalanceTimeWeighted
            .mul(BigNumber.from(10).pow(18))
            .div(updatedSupplyTimeWeighted)
          const allocated = userProportion
            .mul(BigNumber.from(totalReceived))
            .div(BigNumber.from(10).pow(18))
          const withdrawAmt = allocated.sub(BigNumber.from(totalWithdrawnPerUser))
          setWithdrawableFees(withdrawAmt.gt(0) ? withdrawAmt : BigNumber.from(0))
        } else {
          setWithdrawableFees(BigNumber.from(0))
        }
      } catch (err) {
        console.error('Failed to calculate withdrawable fees', err)
        setWithdrawableFees(BigNumber.from(0))
      }
    }

    calculateWithdrawable()
  }, [
    address,
    balanceTimeWeighted,
    supplyTimeWeighted,
    totalReceived,
    totalWithdrawnPerUser,
    lastBalanceUpdate,
    lastSupplyUpdate,
  ])

  const { isMobile } = useWindowSize()

  const { data: VMOONEYLock, isLoading: VMOONEYLockLoading } = useRead({
    contract: vMooneyContract,
    method: 'locked' as string,
    params: [address],
  })

  const { data: mooneyAllowance, isLoading: mooneyAllowanceLoading } = useRead({
    contract: mooneyContract,
    method: 'allowance' as string,
    params: [address, VMOONEY_ADDRESSES[chainSlug]],
  })
  const [hasLock, setHasLock] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading && setHasLock(VMOONEYLock && VMOONEYLock[0] != 0)
  }, [VMOONEYLock, VMOONEYLockLoading, address])

  // 3.75 years ~ 45 months
  const [hasMoreThan45Months, setHasMoreThan45Months] = useState<boolean>(false)
  const fortyFiveMonths = 45 * 30 * 24 * 60 * 60 * 1000
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasMoreThan45Months(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          BigNumber.from(+new Date() + fortyFiveMonths).lte(
            VMOONEYLock?.[1].toString() * 1000
          )
      )
  }, [VMOONEYLock, VMOONEYLockLoading, address, fortyFiveMonths])

  const handleWithdrawFees = async () => {
    try {
      if (!account) throw new Error('No account found')
      const withdrawTx = prepareContractCall({
        contract: feeHookContract,
        method: 'withdrawFees' as string,
        params: [],
      })
      const withdrawReceipt = await sendAndConfirmTransaction({
        transaction: withdrawTx,
        account,
      })
      if (withdrawReceipt) {
        toast.success('Withdrawal submitted!', {
          style: toastStyle,
        })
        setTimeout(() => {
          router.reload()
        }, 5000)
      }
    } catch (error) {
      console.error('Error withdrawing:', error)
      toast.error('Error withdrawing. Please try again.', {
        style: toastStyle,
      })
    }
  }

  return (
    <>
      <WebsiteHead
        title={'Withdraw'}
        description={'Withdraw vMOONEY rewards.'}
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={'Withdraw Rewards'}
            headerSize="max(20px, 3vw)"
            description={
              "Withdraw vMOONEY rewards. To complete your withdrawal, ensure you have an existing vMOONEY lock. You'll need to sign two transactions: one for approval and one to execute the withdrawal."
            }
            preFooter={<NoticeFooter />}
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <div className="mt-3 w-full">
              <section
                className={`py-4 mt-8 flex flex-col ${isMobile ? '' : 'w-1/3'}`}
              >
                <Asset
                  name="ETH"
                  amount={String(
                    (Number(withdrawableFees) / ETH_DECIMALS).toFixed(4)
                  )}
                  usd=""
                />
              </section>
              <StandardButton
                className="gradient-2 rounded-full mt-4"
                onClick={handleWithdrawFees}
              >
                Withdraw Fees
              </StandardButton>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
