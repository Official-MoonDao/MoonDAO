import { useWallets } from '@privy-io/react-auth'
import { TradeType } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'

/*
Step 1: Purchase MATIC -- Check for MATIC balance > selected level

Step 2: Swap MATIC for Mooney -- Check for Mooney balance > selected level

Step 3: Approve Mooney -- Check for Mooney approval > selected level

Step 4: Lock Mooney -- Check for Mooney Lock amnt > selected level
*/

const TESTING = false

type StepProps = {
  realStep: number
  stepNum: number
  title: string
  explanation: string
  action: () => Promise<any>
  isDisabled?: boolean
  txExplanation?: string
  selectedChain: any
  selectedWallet: any
  wallets: any[]
}

function Step({
  realStep,
  stepNum,
  title,
  explanation,
  action,
  isDisabled,
  txExplanation,
  selectedChain,
  selectedWallet,
  wallets
}: StepProps) {
  const [isLoadingAction, setIsLoadingAction] = useState(false)
  const [isProcessingTx, setIsProcessingTx] = useState(false)

  return (
    <div className="mt-5 w-full h-full text-black dark:text-white">
      <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-5 lg:w-full lg:h-full p-2 lg:p-3 border border-gray-500 dark:border-white dark:border-opacity-[0.18]">
        <p
          className={`block px-3 py-1 text-xl font-bold rounded-[9999px] ${
            realStep === stepNum
              ? 'bg-[grey] animate-pulse'
              : realStep > stepNum
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
        <div className="mt-1 opacity-60 text-base font-normal lg:mt-0 xl:text-base">
          {explanation}
        </div>

        {realStep === stepNum && txExplanation && <p>{txExplanation}</p>}
        {/*Previously was a border-4 class on hover for this button but changed it for scale, as increasing border expands the whole container on hover*/}
      </div>
      {realStep === stepNum && (
        <button
          className="my-2 w-[100%] h-auto p-3 space-y-2 hover:scale-105 duration-300 ease-in-out px-8 py-2 text-black dark:text-white text-base font-normal font-['Roboto Mono'] dark:bg-[#FFFFFF14] bg-[#00000025]"
          onClick={async () => {
            //check network
            if (
              +wallets[selectedWallet].chainId.split(':')[1] !==
              +selectedChain.chainId
            ) {
              return toast.error(
                `Please switch wallet to ${selectedChain.name}`
              )
            }

            setIsLoadingAction(true)
            
            try {
              setIsProcessingTx(true)
              await action()
            } catch (err: any) {
              toast.error(err.message.slice(0, 150))
              setIsProcessingTx(false)
            }
          }}
          disabled={isDisabled || isLoadingAction || isProcessingTx}
        >
          {isProcessingTx ? '...processing' : isDisabled || isLoadingAction ? '...loading' : 'Start'}
        </button>
      )}
    </div>
  )
}

export function OnboardingTransactions({
  selectedChain,
  selectedLevel,
  mooneyBalance,
  vMooneyLock,
  tokenAllowance,
  approveMooney,
  createLock,
  setStage
}: any) {
  const [currStep, setCurrStep] = useState(1)

  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  //MoonPay
  const fund = useMoonPay()
  const extraFundsForGas = useMemo(() => {
    return +selectedChain.chainId === 1 ? 0.05 : 1
  }, [selectedChain])

  //Uniswap
  const { MOONEY, NATIVE_TOKEN } = useUniswapTokens()
  const [mooneySwapRoute, setMooneySwapRoute] = useState<any>()
  const {
    generateRoute: generateMooneyRoute,
    executeRoute: executeMooneySwapRoute,
  } = useUniversalRouter(
    selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18,
    NATIVE_TOKEN,
    MOONEY
  )

  useEffect(() => {
    if (selectedLevel.nativeSwapRoute) {
      generateMooneyRoute(TradeType.EXACT_INPUT).then((swapRoute: any) =>
        setMooneySwapRoute(swapRoute)
      )
    }
  }, [selectedLevel?.nativeSwapRoute])

  useEffect(() => {
    const checkStep = async () => {
      if (vMooneyLock?.[0].toString() >= selectedLevel.price) {
        console.log("moving to step 5")
        setCurrStep(5)
        setStage(2)
      }
      else if (
        mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price - 1 &&
        tokenAllowance?.toString() / 10 ** 18 >=
        selectedLevel.price / 2
      ) {
        console.log("moving to step 4")
        setCurrStep(4)
      } 
      else if (
        mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price - 1
      ) {
        console.log("moving to step 3")
        setCurrStep(3)
      }
      else {
        const wallet = wallets[selectedWallet]
        if (!wallet) return
        const provider = await wallet.getEthersProvider()
        const nativeBalance = await provider.getBalance(wallet.address)
        const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
        if (
          +formattedNativeBalance >
            selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
              10 ** 18 ||
          TESTING
        ) {
          console.log("moving to step 2")
          setCurrStep(2)
        }
      }
    }
    checkStep()
  })

  return (
    <div className="mt-2 lg:mt-5 flex flex-col items-center text-slate-950 dark:text-white">
      <div className="w-full flex gap-8 justify-center"></div>
      <Step
        realStep={currStep}
        stepNum={1}
        title={'Purchase MATIC'}
        explanation={
          'You need MATIC to swap it for our governance token $MOONEY.'
        }
        action={async () => {
          const wallet = wallets[selectedWallet]
          if (!wallet) return
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          const levelPrice =
            selectedLevel.nativeSwapRoute.route[0].rawQuote.toString() /
            10 ** 18
          
          const fundTX = await fund(
            levelPrice - +formattedNativeBalance + extraFundsForGas
          )
        }}
        isDisabled={!selectedLevel.nativeSwapRoute?.route[0]}
        txExplanation={`Fund wallet with ${
          selectedLevel.nativeSwapRoute?.route[0]
            ? (
                selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
                  10 ** 18 +
                extraFundsForGas
              ).toFixed(5)
            : '...'
        } ${selectedChain.slug === 'ethereum' ? 'ETH' : 'MATIC'}`}
        selectedChain={selectedChain}
        selectedWallet={selectedWallet}
        wallets={wallets}
      />
      <Step
        realStep={currStep}
        stepNum={2}
        title={'Purchase $MOONEY on Uniswap'}
        explanation={
          'MoonDAO routes the order to the best price on a Decentralized Exchange. The amount of $MOONEY received may vary.'
        }
        action={async () => {
          await executeMooneySwapRoute(mooneySwapRoute)
        }}
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
        selectedChain={selectedChain}
        selectedWallet={selectedWallet}
        wallets={wallets}
      />
      {selectedLevel.hasVotingPower && (
        <>
          <Step
            realStep={currStep}
            stepNum={3}
            title={'Token Approval'}
            explanation={
              'Next, you’ll approve some of the MOONEY tokens for staking. This prepares your tokens for the next step.'
            }
            action={async () => {
              await approveMooney()
            }}
            isDisabled={!mooneySwapRoute}
            txExplanation={`Approve ${(
              selectedLevel.price / 2
            ).toLocaleString()} $MOONEY for staking`}
            selectedChain={selectedChain}
            selectedWallet={selectedWallet}
            wallets={wallets}
          />
          <Step
            realStep={currStep}
            stepNum={4}
            title={'Stake $MOONEY'}
            explanation={
              'Last step, staking tokens gives you voting power within the community and makes you a full member of our community!'
            }
            action={async () => await createLock()}
            txExplanation={`Stake ${
              selectedLevel.price / 2
            } $MOONEY for 1 year`}
            selectedChain={selectedChain}
            selectedWallet={selectedWallet}
            wallets={wallets}
          />
        </>
      )}
    </div>
  )
}
