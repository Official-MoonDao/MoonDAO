import { useWallets } from '@privy-io/react-auth'
import { Polygon } from '@thirdweb-dev/chains'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContext from '../../lib/thirdweb/chain-context'
import { L2_MOONEY, useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'

/*
Step 1: Purchase MATIC -- Check for MATIC balance > selected level

Step 2: Swap MATIC for Mooney -- Check for Mooney balance > selected level

Step 3: Approve Mooney -- Check for Mooney approval > selected level

Step 4: Lock Mooney -- Check for Mooney Lock amnt > selected level
*/

const TESTING = false

type StepProps = {
  stepNum: number
  title: string
  explanation: string
  action: () => Promise<any>
  check: () => Promise<boolean>
  deps?: any[]
  isDisabled?: boolean
  txExplanation?: string
}

export function OnboardingTransactions({
  selectedChain,
  selectedLevel,
  mooneyBalance,
  vMooneyLock,
  tokenAllowance,
  approveMooney,
  createLock,
}: any) {
  const [currStep, setCurrStep] = useState(1)

  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  //MoonPay
  const fund = useMoonPay()

  //Uniswap
  const { MOONEY, NATIVE_TOKEN } = useUniswapTokens()
  const [mooneySwapRoute, setMooneySwapRoute] = useState<any>()
  const {
    generateRoute: generateMooneyRoute,
    executeRoute: executeMooneySwapRoute,
  } = useUniversalRouter(
    selectedLevel?.nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18,
    NATIVE_TOKEN,
    MOONEY
  )

  useEffect(() => {
    if (selectedLevel.nativeSwapRoute) {
      generateMooneyRoute().then((swapRoute: any) =>
        setMooneySwapRoute(swapRoute)
      )
    }
  }, [selectedLevel?.nativeSwapRoute])

  function Step({
    stepNum,
    title,
    explanation,
    action,
    check,
    deps = [],
    isDisabled,
    txExplanation,
  }: StepProps) {
    const [isLoadingCheck, setIsLoadingCheck] = useState(false)
    const [isLoadingAction, setIsLoadingAction] = useState(false)

    useEffect(() => {
      if (currStep === stepNum && !isLoadingCheck) {
        setIsLoadingCheck(true)
        check()
          .then((checkRes) => {
            if (checkRes) {
              setCurrStep(currStep + 1)
            }
          })
          .finally(() => setIsLoadingCheck(false))
      }
    }, [currStep, ...deps])

    return (
      <div className="mt-5 w-full h-full text-black dark:text-white">
        <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-5 lg:w-full lg:h-full p-2 lg:p-3 border border-gray-500 dark:border-white dark:border-opacity-[0.18]">
          <p
            className={`block px-3 text-white py-1 text-xl font-bold rounded-[9999px] ${
              isLoadingCheck
                ? 'bg-[grey] animate-pulse'
                : currStep > stepNum
                ? 'bg-[lightgreen]'
                : 'bg-moon-orange'
            }`}
          >
            {stepNum}
          </p>
          <div className="flex-col justify-start items-start gap-4 inline-flex">
            <div className="mt-[15px] text-left block lg:mt-0 xl:text-xl lg:max-w-[190px]">
              {title}
            </div>
          </div>
          <div className="mt-1 opacity-60 text-white text-base font-normal lg:mt-0 xl:text-base">
            {explanation}
          </div>

          {currStep === stepNum && txExplanation && <p>{txExplanation}</p>}
          {/*Previously was a border-4 class on hover for this button but changed it for scale, as increasing border expands the whole container on hover*/}
        </div>
        {currStep === stepNum && (
          <button
            className="my-2 w-[100%] h-auto p-3 space-y-2 hover:scale-105 duration-300 ease-in-out px-8 py-2 text-white text-base font-normal font-['Roboto Mono']"
            style={{ backgroundColor: '#FFFFFF14' }}
            onClick={async () => {
              setIsLoadingAction(true)
              try {
                await action()
              } catch (err: any) {
                toast.error(err.message.slice(0, 150))
              }
            }}
            disabled={isDisabled || isLoadingAction}
          >
            {isDisabled || isLoadingAction ? '...loading' : 'Start'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 lg:mt-5 flex flex-col items-center text-slate-950 dark:text-white">
      <div className="w-full flex gap-8 justify-center"></div>
      <Step
        stepNum={1}
        title={'Purchase MATIC'}
        explanation={'You need MATIC to swap it for our governance token MOONEY.'}
        action={async () => {
          const wallet = wallets[selectedWallet]
          if (!wallet) return
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          const levelPrice =
            selectedLevel.nativeSwapRoute.route[0].rawQuote.toString() /
            10 ** 18
          const fundTX = await fund(levelPrice - +formattedNativeBalance)
          console.log(fundTX)
        }}
        check={async () => {
          const wallet = wallets[selectedWallet]
          if (!wallet) return false
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          if (
            +formattedNativeBalance >
            selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
              10 ** 18
          ) {
            return true
          } else {
            return false
          }
        }}
        isDisabled={!selectedLevel.nativeSwapRoute?.route[0]}
        deps={[]}
        txExplanation={`Fund wallet with ${
          selectedLevel.nativeSwapRoute?.route[0]
            ? (
                selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
                10 ** 18
              ).toFixed(3)
            : '...'
        } ${selectedChain.slug === 'ethereum' ? 'ETH' : 'MATIC'}`}
      />
      <Step
        stepNum={2}
        title={'Purchase MOONEY on Uniswap'}
        explanation={
          'MoonDAO routes the order to the best price on a Decentralized Exchange using the low gas fees provided by Polygon.'
        }
        action={async () => {
          executeMooneySwapRoute(mooneySwapRoute)
        }}
        check={async () => {
          if (mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price) {
            return true
          } else {
            return false
          }
        }}
        deps={[mooneyBalance]}
        isDisabled={!mooneySwapRoute}
        txExplanation={`Swap ${
          selectedLevel.nativeSwapRoute
            ? (
                selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
                10 ** 18
              ).toFixed(
                selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
                  10 ** 18 >=
                  0.1
                  ? 2
                  : 5
              )
            : '...'
        } ${
          selectedChain.slug === 'ethereum' ? 'ETH' : 'MATIC'
        } for ${selectedLevel.price.toLocaleString()} $MOONEY`}
      />
      {selectedLevel.hasVotingPower && (
        <>
          <Step
            stepNum={3}
            title={'Token Approval'}
            explanation={
              'Next, you’ll approve some of the MOONEY tokens for staking. This prepares your tokens for the next step.'
            }
            action={async () => {
              await approveMooney()
            }}
            check={async () => {
              if (
                tokenAllowance?.toString() / 10 ** 18 >=
                selectedLevel.price / 2
              ) {
                return true
              } else return false
            }}
            deps={[tokenAllowance]}
            isDisabled={!mooneySwapRoute}
            txExplanation={`Approve ${(
              selectedLevel.price / 2
            ).toLocaleString()} $MOONEY for staking`}
          />
          <Step
            stepNum={4}
            title={'Stake MOONEY'}
            explanation={
              'Last step, staking tokens gives you voting power within the community and makes you a full member of our community!'
            }
            action={async () => await createLock()}
            check={async () => {
              if (vMooneyLock?.[0].toString() >= selectedLevel.price) {
                return true
              } else {
                return false
              }
            }}
            deps={[vMooneyLock]}
            txExplanation={`Stake ${
              selectedLevel.price / 2
            } $MOONEY for 2 years`}
          />
        </>
      )}
    </div>
  )
}
