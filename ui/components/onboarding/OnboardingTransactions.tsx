import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useLightAccount } from '../../lib/alchemy/useLightAccount'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useTokenAllowance } from '../../lib/tokens/approve'
import { useMOONEYBalance } from '../../lib/tokens/mooney-token'
import { useVMOONEYLock } from '../../lib/tokens/ve-token'
import { ETH, MOONEY } from '../../lib/uniswap/UniswapTokens'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'
import { VMOONEY_ADDRESSES } from '../../const/config'

/*
Step 1: Purchase ETH -- Check for eth balance > selected level

Step 2: Swap ETh for Mooney -- Check for Mooney balance > selected level

Step 3: Approve Mooney -- Check for Mooney approval > selected level

Step 4: Lock Mooney -- Check for Mooney Lock amnt > selected level
*/

const TESTING = true

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
  selectedLevel,
  mooneyContract,
  vMooneyContract,
  setStage,
  setSelectedLevel,
  selectedChain,
}: any) {
  const address = useAddress()
  const router = useRouter()
  const [currStep, setCurrStep] = useState(1)

  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const wallet = wallets[selectedWallet]

  //MoonPay
  const fund = useMoonPay()

  //Uniswap
  const [nativeSwapRoute, setNativeSwapRoute] = useState<any>()
  const [mooneySwapRoute, setMooneySwapRoute] = useState<any>()
  const { generateRoute: generateNativeRoute } = useSwapRouter(
    selectedLevel.price,
    MOONEY,
    ETH
  )
  const {
    generateRoute: generateMooneyRoute,
    executeRoute: executeMooneySwapRoute,
  } = useSwapRouter(nativeSwapRoute?.route[0].rawQuote.toString(), ETH, MOONEY)

  //Alchemy
  const lightAccountProvider: any = useLightAccount(wallets)

  //Thirdweb
  const { data: mooneyBalance } = useMOONEYBalance(
    mooneyContract,
    wallet?.address
  )

  const { data: vMooneyLock } = useVMOONEYLock(vMooneyContract, wallet?.address)

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    wallet?.address,
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  useEffect(() => {
    generateNativeRoute().then((swapRoute: any) =>
      setNativeSwapRoute(swapRoute)
    )
  }, [])

  useEffect(() => {
    if (nativeSwapRoute?.route[0]) {
      generateMooneyRoute().then((swapRoute: any) =>
        setMooneySwapRoute(swapRoute)
      )
    }
  }, [nativeSwapRoute])

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
    const [checkResult, setCheckResult] = useState(true)
    const [sentTx, setSentTx] = useState(false)
    useEffect(() => {
      if (currStep === stepNum && !isLoadingCheck) {
        setIsLoadingCheck(true)
        ;(async () => {
          const checkRes = await check()
          setCheckResult(checkRes)
          if (checkRes) {
            setCurrStep(stepNum + 1)
          }
          setIsLoadingCheck(false)
        })()
      }
    }, [currStep, selectedLevel, address, ...deps])

    // useEffect(() => {
    //   if (!checkResult && !isLoadingCheck && !sentTx) {
    //     setSentTx(true)
    //     action()
    //   }
    // }, [checkResult, sentTx])

    return (
      <div className="mt-5 w-full text-black dark:text-white">
        <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-5 lg:w-full p-2 lg:p-3 border border-gray-500 dark:border-white dark:border-opacity-[0.18]">
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
          <p className="mt-[15px] block lg:mt-0 xl:text-xl lg:max-w-[190px]">
            {title}
          </p>
          <p className="mt-1 opacity-60 block lg:mt-0 text-sm xl:text-base">
            {explanation}
          </p>
          {currStep === stepNum && txExplanation && <p>{txExplanation}</p>}
          {/*Previously was a border-4 class on hover for this button but changed it for scale, as increasing border expands the whole container on hover*/}
          <div>
            {currStep === stepNum && (
              <button
                className="w-full my-2 border-2 hover:scale-105 duration-300 ease-in-out border-gray-900 dark:border-white px-8 py-2"
                onClick={async () => {
                  try {
                    await action()
                  } catch (err: any) {
                    toast.error(err.message.slice(0, 150))
                  }
                }}
                disabled={isDisabled}
              >
                {isDisabled ? '...loading' : 'Complete this Step'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    //check if user has already completed steps (vmooney > selectedLevel)
    if (vMooneyLock) {
      const completed =
        vMooneyLock?.[0].toString() / 10 ** 18 >= selectedLevel.price
      if (completed) {
        setCurrStep(4)
        setTimeout(() => {
          setStage(3)
        }, 3000)
      }
    }
  }, [vMooneyLock])

  return (
    <div className="mt-2 lg:mt-5 flex flex-col items-center text-slate-950 dark:text-white">
        <button
          className="mt-3 py-2 px-4 lg:py-3 lg:px-5 border border-slate-950 dark:border-white lg:self-start transition-all duration-105 hover:scale-105"
          onClick={() => {
            setStage(1)
            setSelectedLevel({ price: 0, hasVotingPower: false })
          }}
        >
          Back ↩
        </button>
      <div className="w-full flex gap-8 justify-center">
      </div>
      <Step
        stepNum={1}
        title={'Purchase ETH'}
        explanation={'You need ETH to swap it for our governance token MOONEY.'}
        action={async () => {
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          await fund(selectedLevel.price - +formattedNativeBalance)
        }}
        check={async () => {
          const provider = await wallet.getEthersProvider()
          const nativeBalance = await provider.getBalance(wallet.address)
          const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
          if (
            +formattedNativeBalance >
              nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18
          ) {
            return true
          } else {
            return false
          }
        }}
        isDisabled={!nativeSwapRoute?.route[0]}
        deps={[nativeSwapRoute]}
        txExplanation={`Fund wallet with ${
          nativeSwapRoute?.route[0]
            ? nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18
            : '...'
        } ETH`}
      />
      <Step
        stepNum={2}
        title={'Purchase MOONEY on Uniswap'}
        explanation={
          'MoonDAO routes the order to the best price on a Decentralized Exchange using the low gas fees provided by Polygon.'
        }
        action={async () => await executeMooneySwapRoute(mooneySwapRoute)}
        check={async () => {
          if (mooneyBalance?.toString() >= selectedLevel.price) {
            return true
          } else {
            return false
          }
        }}
        deps={[mooneyBalance]}
        isDisabled={!mooneySwapRoute}
        txExplanation={`Swap ${
          nativeSwapRoute
            ? nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18
            : '...'
        } ETH for ${selectedLevel.price.toLocaleString()} $MOONEY`}
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
              await mooneyContract.call('approve', [
                VMOONEY_ADDRESSES[selectedChain.slug],
                selectedLevel.price,
              ])
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
            action={async () =>
              await vMooneyContract.call('create_lock', [
                selectedLevel.price / 2,
                Date.now() * 1000 * 60 * 60 * 24 * 365 * 2,
              ])
            }
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
