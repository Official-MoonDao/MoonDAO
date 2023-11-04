import { useWallets } from '@privy-io/react-auth'
import { Ethereum } from '@thirdweb-dev/chains'
import { ThirdwebSDK, useContract, useSigner } from '@thirdweb-dev/react'
import { set } from 'cypress/types/lodash'
import { BigNumber, ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'
import { useMOONEYBalance } from '../../lib/tokens/mooney-token'
import { useVMOONEYCreateLock, useVMOONEYLock } from '../../lib/tokens/ve-token'
import { ETH, MOONEY } from '../../lib/uniswap/UniswapTokens'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'
import { actionAsyncStorage } from 'next/dist/client/components/action-async-storage'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../../const/config'

/*
Step 1: Purchase ETH -- Check for eth balance > selected level

Step 2: Swap ETh for Mooney -- Check for Mooney balance > selected level

Step 3: Approve Mooney -- Check for Mooney approval > selected level

Step 4: Lock Mooney -- Check for Mooney Lock amnt > selected level
*/

type StepProps = {
  stepNum: number
  title: string
  explanation: string
  action: () => Promise<any>
  check: () => Promise<boolean>
  deps?: any[]
}

export function OnboardingTransactions({
  selectedLevel,
  mooneyContract,
  vMooneyContract,
  setStage,
}: any) {
  const [currStep, setCurrStep] = useState(1)
  const [isLoadingTx, setIsLoadingTx] = useState(false)
  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const wallet = wallets[selectedWallet]

  //MoonPay
  const fund = useMoonPay()
  //Alchemy

  //Uniswap
  const [swapRoute, setSwapRoute] = useState<any>()
  const { generateRoute, executeRoute } = useSwapRouter(
    selectedLevel,
    ETH,
    MOONEY
  )

  //Thirdweb

  const { data: mooneyBalance } = useMOONEYBalance(
    mooneyContract,
    wallet.address
  )

  const { data: vMooneyLock } = useVMOONEYLock(vMooneyContract, wallet.address)

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    wallet.address,
    VMOONEY_ADDRESSES['ethereum']
  )

  useEffect(() => {
    generateRoute().then((swapRoute: any) => setSwapRoute(swapRoute))
  }, [selectedLevel])

  function Step({
    stepNum,
    title,
    explanation,
    action,
    check,
    deps = [],
  }: StepProps) {
    const [isLoading, setIsLoading] = useState(false)
    useEffect(() => {
      ;(async () => {
        if (currStep === stepNum) {
          setIsLoading(true)
          const checkRes = await check()
          if (checkRes) {
            setIsLoading(false)
            setCurrStep(stepNum + 1)
          } else if (!isLoading) {
            setIsLoading(true)
            action().then(() => setIsLoading(false))
          }
        }
      })()
    }, [selectedLevel, wallet.address, ...deps])

    return (
      <div className="mt-5">
        <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-5 lg:w-full p-2 lg:p-3 border border-white border-opacity-[0.18]">
          <p
            className={`block px-3 py-1 text-xl font-bold rounded-[9999px] ${
              isLoading
                ? 'bg-[grey]'
                : currStep > stepNum
                ? 'bg-[lightgreen]'
                : 'bg-moon-orange'
            } ${isLoading && 'animate-pulse'}`}
          >
            {stepNum}
          </p>
          <p className="mt-[15px] block lg:mt-0 xl:text-xl lg:max-w-[190px]">
            {title}
          </p>
          <p className="mt-1 opacity-60 block lg:mt-0 text-sm xl:text-base">
            {explanation}
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    //check if user has already completed steps (vmooney > selectedLevel)
    if (swapRoute && vMooneyLock) {
      const completed =
        vMooneyLock?.[0].toString() >= swapRoute.route[0].rawQuote.toString()
      if (completed) {
        setCurrStep(4)
        setTimeout(() => {
          setStage(3)
        }, 3000)
      }
    }
  }, [swapRoute, vMooneyContract, wallet, selectedLevel])

  return (
    <div className="mt-2 lg:mt-5">
      <Step
        stepNum={1}
        title={'Purchase ETH'}
        explanation={'You need ETH to swap it for our governance token MOONEY.'}
        action={async () => {
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          await fund(selectedLevel - +formattedNativeBalance)
        }}
        check={async () => {
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          if (formattedNativeBalance > selectedLevel) {
            return true
          } else {
            return false
          }
        }}
      />
      <Step
        stepNum={2}
        title={'Purchase MOONEY on Uniswap'}
        explanation={
          'MoonDAO routes the order to the best price on a Decentralized Exchange using the low gas fees provided by Polygon.'
        }
        action={async () => await executeRoute(swapRoute)}
        check={async () => {
          const selectedLevelMooneyAmt = swapRoute?.route[0].rawQuote.toString()
          if (mooneyBalance?.toString() >= selectedLevelMooneyAmt) {
            return true
          } else {
            return false
          }
        }}
        deps={[]}
      />
      <Step
        stepNum={3}
        title={'Token Approval'}
        explanation={
          'Next, you’ll approve some of the MOONEY tokens for staking. This prepares your tokens for the next step.'
        }
        action={async () => {
          const selectedLevelMooneyAmt = swapRoute?.route[0].rawQuote.toString()
          await mooneyContract.call('approve', [
            VMOONEY_ADDRESSES['ethereum'],
            selectedLevelMooneyAmt,
          ])
        }}
        check={async () => {
          const selectedLevelMooneyAmt = swapRoute?.route[0].rawQuote.toString()
          if (tokenAllowance.toString() >= selectedLevelMooneyAmt) {
            return true
          } else return false
        }}
        deps={[tokenAllowance]}
      />
      <Step
        stepNum={4}
        title={'Stake MOONEY'}
        explanation={
          'Last step, staking tokens gives you voting power within the community and makes you a full member of our community!'
        }
        action={async () =>
          await vMooneyContract.call('create_lock', [
            swapRoute?.route[0].rawQuote.toString(),
            Date.now() * 1000 * 60 * 60 * 24 * 365 * 2,
          ])
        }
        check={async () => {
          const selectedLevelMooneyAmt = swapRoute?.route[0].rawQuote.toString()
          if (vMooneyLock?.[0].toString() >= selectedLevelMooneyAmt) {
            return true
          } else {
            return false
          }
        }}
        deps={[vMooneyLock]}
      />
    </div>
  )
}
