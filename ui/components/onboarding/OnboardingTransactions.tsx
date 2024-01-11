import { useWallets } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { TradeType } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import { useContext, useEffect, useMemo, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useHandleRead, useHandleWrite } from '../../lib/thirdweb/hooks'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import CitizenNFTABI from '../../const/abis/CitizenNFT.json'
import { CITIZEN_NFT_ADDRESSES, VMOONEY_ADDRESSES } from '../../const/config'
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

  const [enablePurchaseNativeTokenModal, setEnablePurchaseNativeTokenModal] =
    useState(false)

  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

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

  const { mutateAsync: approveMooney, isLoading: isLoadingApproveMooney } =
    useHandleWrite(mooneyContract, 'approve', [
      VMOONEY_ADDRESSES[selectedChain.slug],
      ethers.utils.parseEther(String(selectedLevel.price / 2)),
    ])
  const { mutateAsync: createLock, isLoading: isLoadingCreateLock } =
    useHandleWrite(vMooneyContract, 'create_lock', [
      ethers.utils.parseEther(String(selectedLevel.price / 2)),
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 1,
    ])

  const { contract: citizenNFTContract } = useContract(
    CITIZEN_NFT_ADDRESSES[selectedChain.slug],
    CitizenNFTABI
  )

  const { mutateAsync: mintCitizenNFT } = useHandleWrite(
    citizenNFTContract,
    'mint'
  )

  const [nativeBalance, setNativeBalance] = useState<any>()

  async function getNativeBalance() {
    const wallet = wallets[selectedWallet]
    if (!wallet) return
    const provider = await wallet.getEthersProvider()
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

  const extraFundsForGas = useMemo(() => {
    return +selectedChain.chainId === 1 ? 0.05 : 1
  }, [selectedChain])

  async function checkStep() {
    const vMooneyLock = await vMooneyContract.call('locked', [address])
    const mooneyBalance = await mooneyContract.call('balanceOf', [address])
    const tokenAllowance = await mooneyContract.call('allowance', [
      address,
      VMOONEY_ADDRESSES[selectedChain.slug],
    ])

    //check for citizen NFT
    if (selectedChain.slug === 'polygon' && citizenNFTContract) {
      const citizenNFTBalance = await citizenNFTContract.call('balanceOf', [
        address,
        0,
      ])
      if (citizenNFTBalance.toString() > 0) {
        setCurrStep(5)
        setStage(2)
      }
    }

    //check for vmooney, approval, mooney balance, and native balance
    if (vMooneyLock?.[0].toString() >= selectedLevel.price * 10 ** 18 * 0.5) {
      setCurrStep(5)
      if (selectedChain.slug !== 'polygon') {
        setStage(2)
      }
      return
    } else if (
      !selectedLevel.hasVotingPower &&
      mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price - 1
    ) {
      setCurrStep(5)
      return setStage(2)
    } else if (
      mooneyBalance?.toString() / 10 ** 18 >= selectedLevel.price / 2 - 1 &&
      tokenAllowance?.toString() / 10 ** 18 >= selectedLevel.price / 2
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

  const selectedChainName = selectedChain.slug === 'ethereum' ? 'ETH' : 'MATIC'

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
            } ${selectedChain.slug === 'ethereum' ? 'ETH' : 'MATIC'}`}
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
                  'Approve the $MOONEY tokens for staking. This prepares your tokens for the next step.'
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
                title={'Stake $MOONEY'}
                explanation={
                  'Stake your tokens for voting power within the community.'
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
              {selectedChain.slug === 'polygon' && (
                <Step
                  realStep={currStep}
                  stepNum={5}
                  title={'Mint Citizen NFT'}
                  explanation={
                    'Mint your Citizen Mission Patch NFT and join the MoonDAO community!'
                  }
                  action={async () => {
                    await mintCitizenNFT()
                      .then(() => {
                        setChecksLoaded(false)
                        checkStep()
                      })
                      .catch((err) => {
                        throw err
                      })
                  }}
                  txExplanation={`Mint Citizen Mission Patch NFT`}
                  selectedChain={selectedChain}
                  selectedWallet={selectedWallet}
                  wallets={wallets}
                />
              )}
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
                  'Approve the $MOONEY tokens for staking. This prepares your tokens for the next step.'
                }
              />
              <StepLoading
                stepNum={4}
                title={'Stake $MOONEY'}
                explanation={
                  'Stake your tokens for voting power within the community.'
                }
              />
              {selectedChain.slug === 'polygon' && (
                <StepLoading
                  stepNum={5}
                  title={'Mint Citizen NFT'}
                  explanation={
                    'Mint your Citizen Mission Patch NFT and join the MoonDAO community!'
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
