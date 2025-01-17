import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { TradeType } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { useContext, useEffect, useMemo, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useHandleWrite } from '../../lib/thirdweb/hooks'
import { useUniswapTokens } from '../../lib/uniswap/hooks/useUniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { PrivyWeb3Button } from '../../components/privy/PrivyWeb3Button'
import { CHAIN_TOKEN_NAMES, VMOONEY_ADDRESSES } from '../../const/config'
import { PurhcaseNativeTokenModal } from './PurchaseNativeTokenModal'
import { Step } from './TransactionStep'
import { StepLoading } from './TransactionStepLoading'

/*
Step 1: Purchase MATIC -- Check for MATIC balance > selected level

Step 2: Swap MATIC for Mooney -- Check for Mooney balance > selected level

Step 3: Approve Mooney -- Check for Mooney approval > selected level

Step 4: Lock Mooney -- Check for Mooney Lock amnt > selected level
*/

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

  const [networkMismatch, setNetworkMismatch] = useState(false)

  const [enablePurchaseNativeTokenModal, setEnablePurchaseNativeTokenModal] =
    useState(false)

  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  //Uniswap
  const { MOONEY } = useUniswapTokens(selectedChain)
  const [mooneySwapRoute, setMooneySwapRoute] = useState<any>()
  const {
    generateRoute: generateMooneyRoute,
    executeRoute: executeMooneySwapRoute,
  } = useUniversalRouter(
    selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18,
    nativeOnChain(selectedChain.chainId),
    MOONEY
  )

  const { mutateAsync: approveMooney, isLoading: isLoadingApproveMooney } =
    useHandleWrite(mooneyContract, 'approve', [
      VMOONEY_ADDRESSES[selectedChain.slug],
      ethers.utils.parseEther(String(selectedLevel.price / 2 + 1)),
    ])
  const { mutateAsync: createLock, isLoading: isLoadingCreateLock } =
    useHandleWrite(vMooneyContract, 'create_lock', [
      ethers.utils.parseEther(String(selectedLevel.price / 2)),
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    ])

  const [nativeBalance, setNativeBalance] = useState<any>()

  async function getNativeBalance() {
    const wallet = wallets[selectedWallet]
    if (!wallet) return
    const privyProvider = await wallet.getEthereumProvider()
    const provider = new ethers.providers.Web3Provider(privyProvider)
    const nativeBalance = await provider.getBalance(wallet.address)
    const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
    setNativeBalance(formattedNativeBalance)
  }

  useEffect(() => {
    getNativeBalance()
  }, [wallets, selectedWallet])

  useEffect(() => {
    if (selectedLevel.nativeSwapRoute) {
      generateMooneyRoute(TradeType.EXACT_INPUT).then((swapRoute: any) =>
        setMooneySwapRoute(swapRoute)
      )
    }
  }, [selectedLevel?.nativeSwapRoute])

  useEffect(() => {
    if (
      selectedChain.chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      setNetworkMismatch(true)
    } else {
      setNetworkMismatch(false)
    }
  }, [selectedChain])

  const extraFundsForGas = useMemo(() => {
    let gas
    if (+selectedChain.chainId === 1) {
      gas = 0.003
    } else if (+selectedChain.chainId === 137) {
      gas = 1
    } else if (+selectedChain.chainId === 42161) {
      gas = 0.001
    } else {
      gas = 0
    }
    return gas
  }, [selectedChain])

  async function checkStep() {
    const vMooneyLock = await vMooneyContract.call('locked', [address])
    const mooneyBalance = await mooneyContract.call('balanceOf', [address])
    const tokenAllowance = await mooneyContract.call('allowance', [
      address,
      VMOONEY_ADDRESSES[selectedChain.slug],
    ])

    //check for vmooney, approval, mooney balance, and native balance
    if (vMooneyLock?.[0].toString() >= selectedLevel.price * 10 ** 18 * 0.5) {
      setCurrStep(4)
      if (selectedChain.slug !== 'polygon') {
        setStage(2)
      }
      return
    } else if (
      !selectedLevel.hasVotingPower &&
      mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price - 1
    ) {
      setCurrStep(4)
      return setStage(2)
    } else if (
      mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price / 2 - 1 &&
      tokenAllowance?.toString() / 10 ** 18 >= selectedLevel.price / 2 - 1
    ) {
      return setCurrStep(4)
    } else if (
      mooneyBalance?.toString() / 10 ** 18 >=
      selectedLevel.price - 1
    ) {
      return setCurrStep(3)
    } else {
      const wallet = wallets[selectedWallet]
      if (!wallet) return
      const provider = await wallet.getEthersProvider()
      const nativeBalance = await provider.getBalance(wallet.address)
      const formattedNativeBalance = ethers.utils.formatEther(nativeBalance)
      if (
        +formattedNativeBalance >
        selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18 +
          extraFundsForGas
      ) {
        setCurrStep(2)
      }
    }
  }

  useEffect(() => {
    checkStep()
    const check = setInterval(() => {
      checkStep().then(() => setChecksLoaded(true))
    }, 3000)

    return () => clearInterval(check)
  }, [])

  const nativeAmount =
    selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() / 10 ** 18

  const selectedChainName = CHAIN_TOKEN_NAMES[selectedChain.slug]

  if (networkMismatch) {
    return (
      <div className="flex flex-col p-12">
        <p className="flex items-center">
          Please switch your wallet to {selectedChain.name} to continue.
        </p>
        <div className="mt-4">
          <PrivyWeb3Button label="" action={() => {}} />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 lg:mt-5 flex flex-col items-center text-slate-950 dark:text-white">
      {enablePurchaseNativeTokenModal && (
        <PurhcaseNativeTokenModal
          wallets={wallets}
          selectedWallet={selectedWallet}
          selectedChain={selectedChain}
          nativeAmount={
            selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
            10 ** 18
          }
          setEnabled={setEnablePurchaseNativeTokenModal}
          extraFundsForGas={extraFundsForGas}
          nativeBalance={nativeBalance}
        />
      )}
      {checksLoaded ? (
        <>
          <Step
            realStep={currStep}
            stepNum={1}
            title={`Buy ${selectedChainName}`}
            explanation={`You need ${selectedChainName} to swap for our governance token $MOONEY. Use MoonPay to onboard using a credit card. Otherwise, you can acquire ${selectedChainName} on an exchange and then send your tokens to your connected wallet.`}
            action={async () => {
              setEnablePurchaseNativeTokenModal(true)
            }}
            isDisabled={!selectedLevel.nativeSwapRoute?.route[0]}
            txExplanation={`Fund wallet with ${
              selectedLevel.nativeSwapRoute?.route[0]
                ? (
                    selectedLevel.nativeSwapRoute?.route[0].rawQuote.toString() /
                      10 ** 18 +
                    extraFundsForGas -
                    nativeBalance
                  ).toFixed(5)
                : '...'
            } ${selectedChainName}`}
            selectedChain={selectedChain}
            selectedWallet={selectedWallet}
            wallets={wallets}
            noTxns
            nativeAmount={nativeAmount}
            extraFundsForGas={extraFundsForGas}
          />
          <Step
            realStep={currStep}
            stepNum={2}
            title={`Swap ${selectedChainName} for $MOONEY`}
            explanation={`Swap your ${selectedChainName} for $MOONEY on Uniswap. The amount of $MOONEY received may vary based on current prices.`}
            action={async () => {
              await executeMooneySwapRoute(mooneySwapRoute).then(() => {
                checkStep()
              })
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
                  'Approve the $MOONEY tokens for locking. This prepares your tokens for the next step.'
                }
                action={async () => {
                  await approveMooney()
                    .then(() => {
                      checkStep()
                    })
                    .catch((err) => {
                      throw err
                    })
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
                title={'Lock $MOONEY'}
                explanation={
                  'Lock your tokens for voting power within the community.'
                }
                action={async () => {
                  await createLock()
                    .then(() => {
                      selectedChain.slug !== 'polygon' && setChecksLoaded(false)
                      checkStep()
                    })
                    .catch((err) => {
                      throw err
                    })
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
            title={`Buy ${selectedChainName}`}
            explanation={`You need ${selectedChainName} to swap for our governance token $MOONEY. Use MoonPay to onboard using a credit card. Otherwise, you can acquire ${selectedChainName} on an exchange and then send your tokens to your connected wallet.`}
          />
          <StepLoading
            stepNum={2}
            title={`Swap ${selectedChainName} for $MOONEY`}
            explanation={`Swap your ${selectedChainName} for $MOONEY on Uniswap. The amount of $MOONEY received may vary based on current prices.`}
          />
          {selectedLevel.hasVotingPower && (
            <>
              <StepLoading
                stepNum={3}
                title={'Token Approval'}
                explanation={
                  'Approve the $MOONEY tokens for locking. This prepares your tokens for the next step.'
                }
              />
              <StepLoading
                stepNum={4}
                title={'Lock $MOONEY'}
                explanation={
                  'Lock your tokens for voting power within the community.'
                }
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
