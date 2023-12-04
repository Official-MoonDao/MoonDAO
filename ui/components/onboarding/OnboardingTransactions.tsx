import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { Transaction } from '@thirdweb-dev/sdk'
import { TradeType } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useHandleWrite } from '../../lib/thirdweb/hooks'
import { useTokenAllowance } from '../../lib/tokens/approve'
import { useMOONEYBalance } from '../../lib/tokens/mooney-token'
import { useVMOONEYLock } from '../../lib/tokens/ve-token'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { VMOONEY_ADDRESSES } from '../../const/config'
import { Step } from './TransactionStep'
import { StepLoading } from './TransactionStepLoading'

/*
Step 1: Purchase MATIC -- Check for MATIC balance > selected level

Step 2: Swap MATIC for Mooney -- Check for Mooney balance > selected level

Step 3: Approve Mooney -- Check for Mooney approval > selected level

Step 4: Lock Mooney -- Check for Mooney Lock amnt > selected level
*/

const TESTING = false

export function OnboardingTransactions({
  selectedChain,
  selectedLevel,
  mooneyContract,
  vMooneyContract,
  setStage,
}: any) {
  const address = useAddress()
  const [currStep, setCurrStep] = useState(1)
  const [checksLoaded, setChecksLoaded] = useState(false)

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

  const { mutateAsync: createLock, isLoading: isLoadingCreateLock } =
    useHandleWrite(vMooneyContract, 'create_lock', [
      ethers.utils.parseEther(String(selectedLevel.price / 2)),
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 1,
    ])

  const { mutateAsync: approveMooney, isLoading: isLoadingApproveMooney } =
    useHandleWrite(mooneyContract, 'approve', [
      VMOONEY_ADDRESSES[selectedChain.slug],
      ethers.utils.parseEther(String(selectedLevel.price / 2)),
    ])

  useEffect(() => {
    if (selectedLevel.nativeSwapRoute) {
      generateMooneyRoute(TradeType.EXACT_INPUT).then((swapRoute: any) =>
        setMooneySwapRoute(swapRoute)
      )
    }
  }, [selectedLevel?.nativeSwapRoute])

  async function checkStep() {
    const vMooneyLock = await vMooneyContract.call('locked', [address])
    const mooneyBalance = await mooneyContract.call('balanceOf', [address])
    const tokenAllowance = await mooneyContract.call('allowance', [
      address,
      VMOONEY_ADDRESSES[selectedChain.slug],
    ])

    if (vMooneyLock?.[0].toString() >= (selectedLevel.price * 10 ** 18) * 0.5) {
      console.log(vMooneyLock?.[0].toString())
      console.log(selectedLevel.price)
      setCurrStep(5)
      setStage(2)
    } else if (
      mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price - 1 &&
      tokenAllowance?.toString() / 10 ** 18 >= selectedLevel.price / 2
    ) {
      setCurrStep(4)
    } else if (
      mooneyBalance?.toString() / 10 ** 18 >=
      selectedLevel.price - 1
    ) {
      setCurrStep(3)
    } else {
      const wallet = wallets[selectedWallet]
      if (!wallet) return
      const provider = await wallet.getEthersProvider()
      const nativeBalance = await provider.getBalance(wallet.address)
      const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
      if (
        +formattedNativeBalance >
          selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
            10 ** 18 + extraFundsForGas ||
        TESTING
      ) {
        setCurrStep(2)
      }
    }
  }

  useEffect(() => {
    const check = setInterval(() => {
      checkStep().then(() => setChecksLoaded(true))
    }, 5000)

    return () => clearInterval(check)
  }, [])


  return (
    <div className="mt-2 lg:mt-5 flex flex-col items-center text-slate-950 dark:text-white">
      {checksLoaded ? (
        <>
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
              10 ** 18 + extraFundsForGas

            await fund(levelPrice - +formattedNativeBalance + extraFundsForGas)
            await checkStep()
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
            await checkStep()
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
                const tx = await approveMooney()
                await checkStep()
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
              action={async () => {
                const tx = await createLock()
                await checkStep()
              }}
              txExplanation={`Stake ${
                selectedLevel.price / 2
              } $MOONEY for 1 year`}
              selectedChain={selectedChain}
              selectedWallet={selectedWallet}
              wallets={wallets}
            />
          </>
        )}
        </>
      ) : (
        <>
        <StepLoading
          stepNum={1}
          title={'Purchase MATIC'}
          explanation={
            'You need MATIC to swap it for our governance token $MOONEY.'
          }
        />
        <StepLoading
          stepNum={2}
          title={'Purchase $MOONEY on Uniswap'}
          explanation={
            'MoonDAO routes the order to the best price on a Decentralized Exchange. The amount of $MOONEY received may vary.'
          }
        />
        {selectedLevel.hasVotingPower && (
          <>
            <StepLoading
              stepNum={3}
              title={'Token Approval'}
              explanation={
                'Next, you’ll approve some of the MOONEY tokens for staking. This prepares your tokens for the next step.'
              }
            />
            <StepLoading
              stepNum={4}
              title={'Stake $MOONEY'}
              explanation={
                'Last step, staking tokens gives you voting power within the community and makes you a full member of our community!'
              }
            />
          </>
        )}
        </>
      )}

      
    </div>
  )
}
