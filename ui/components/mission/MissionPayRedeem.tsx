import { ArrowDownIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import { useFundWallet } from '@privy-io/react-auth'
import MISSION_CROSS_CHAIN_PAY_ABI from 'const/abis/CrossChainPay.json'
import JBMultiTerminalABI from 'const/abis/JBV4MultiTerminal.json'
import {
  DEFAULT_CHAIN_V5,
  MISSION_CROSS_CHAIN_PAY_ADDRESS,
  LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID,
  JB_NATIVE_TOKEN_ADDRESS,
} from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  simulateTransaction,
  ZERO_ADDRESS,
  readContract,
  waitForReceipt,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import {
  arbitrum,
  base,
  ethereum,
  sepolia,
  optimismSepolia,
} from '@/lib/infura/infuraChains'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'
import useSafe from '@/lib/safe/useSafe'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import useRead from '@/lib/thirdweb/hooks/useRead'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import viemChains from '@/lib/viem/viemChains'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import { CopyIcon } from '../assets'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import AcceptedPaymentMethods from '../privy/AcceptedPaymentMethods'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionDeployTokenModal from './MissionDeployTokenModal'
import MissionTokenExchangeRates from './MissionTokenExchangeRates'
import MissionTokenNotice from './MissionTokenNotice'

function MissionPayRedeemContent({
  token,
  output,
  redeem,
  setMissionPayModalEnabled,
  tokenBalance,
  currentStage,
  stage,
  tokenCredit,
  claimTokenCredit,
  handleUsdInputChange,
  calculateEthAmount,
  formattedUsdInput,
  formatTokenAmount,
}: any) {
  const isRefundable = stage === 3

  if (
    isRefundable &&
    (!tokenCredit || tokenCredit <= 0) &&
    (!tokenBalance || tokenBalance <= 0)
  ) {
    return null
  }

  return (
    <div
      id="mission-pay-redeem-container"
      className="z-50 bg-[#020617] rounded-[5vw] md:rounded-[2vw] w-full flex flex-col gap-4 lg:min-w-[430px] xl:items-stretch"
    >
      <div
        id="mission-pay-container"
        className="lg:rounded-lg w-full flex-1 p-5 xl:p-5 flex flex-col gap-4 rounded-2xl justify-between"
      >
        {/* You pay */}
        {!isRefundable && (
          <div className="relative flex flex-col gap-4">
            {/* You pay - USD input with ETH display */}
            <div className="relative">
              <div className="p-4 pb-12 flex flex-col gap-3 bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm opacity-60">You pay</h3>
                </div>

                <div className="flex justify-between sm:items-center flex-col sm:flex-row ">
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-bold">$</span>
                    <input
                      id="usd-contribution-input"
                      type="text"
                      className="bg-transparent border-none outline-none text-xl font-bold min-w-[1ch] w-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={formattedUsdInput}
                      onChange={handleUsdInputChange}
                      placeholder="0"
                      maxLength={9}
                      style={{
                        width: `${Math.max(
                          formattedUsdInput.length || 1,
                          1
                        )}ch`,
                      }}
                    />
                    <span className="text-xl font-bold">USD</span>
                  </div>
                  <div className="flex mt-2 sm:mt-0 gap-2 items-center sm:bg-[#111C42] rounded-full sm:px-3 py-1">
                    <Image
                      src="/coins/ETH.svg"
                      alt="ETH"
                      width={16}
                      height={16}
                      className="w-5 h-5 bg-light-cool rounded-full"
                    />
                    <span className="text-base">
                      {calculateEthAmount()} ETH
                    </span>
                  </div>
                </div>
              </div>

              {token?.tokenSymbol && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <ArrowDownIcon
                    className="p-2 w-12 h-12 bg-darkest-cool rounded-full"
                    color={'#121C42'}
                  />
                </div>
              )}
            </div>

            {/* You receive */}
            {token?.tokenSymbol && (
              <div className="p-4 pb-12 flex flex-col gap-3 bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-b-2xl">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm opacity-60">You receive</h3>
                </div>

                <div className="sm:flex justify-between items-center">
                  <p id="token-output" className="text-xl font-bold">
                    {formatTokenAmount(output, 2)}
                  </p>
                  <div className="relative flex mt-2 sm:mt-0 gap-2 items-center sm:bg-[#111C42] rounded-full p-1 sm:px-2">
                    <Image
                      src="/assets/icon-star.svg"
                      alt="Token"
                      width={20}
                      height={20}
                      className="bg-orange-500 rounded-full p-1 w-5 h-5"
                    />
                    {token?.tokenSymbol}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {!isRefundable && (
          <>
            <StandardButton
              id="open-contribute-modal"
              className="rounded-full gradient-2 rounded-full w-full py-1"
              onClick={() => setMissionPayModalEnabled(true)}
              hoverEffect={false}
            >
              Contribute
            </StandardButton>
            <div className="w-full">
              <AcceptedPaymentMethods />
              <p className="xl:text-sm text-center">
                {'Want to contribute by wire transfer?'}
                <br />
                {'Email us at info@moondao.com'}
              </p>
            </div>
          </>
        )}
        {token?.tokenSymbol && +tokenCredit?.toString() > 0 && (
          <StandardButton
            id="claim-button"
            className="rounded-full gradient-2 rounded-full w-full py-1"
            onClick={claimTokenCredit}
            hoverEffect={false}
          >
            Claim {formatTokenAmount(tokenCredit.toString() / 1e18, 0)} $
            {token?.tokenSymbol}
          </StandardButton>
        )}
      </div>
      {/* Token stats and redeem container */}
      <div className="xl:pt-4 flex flex-row justify-between gap-4 w-full">
        {token?.tokenSupply > 0 && !isRefundable && (
          <div id="mission-token-stats" className="w-full px-2 rounded-2xl">
            <div className="p-5 pt-0 flex gap-5 items-start justify-center md:justify-start xl:justify-center">
              <div className="text-lg">
                <h3 className="opacity-60 text-sm">Current Supply</h3>
                <p>
                  {formatTokenAmount(
                    Math.floor(token?.tokenSupply.toString() / 1e18),
                    0
                  )}{' '}
                  ${token?.tokenSymbol}
                </p>
              </div>
              <div className="">
                <MissionTokenExchangeRates
                  currentStage={currentStage}
                  tokenSymbol={token?.tokenSymbol}
                />
              </div>
            </div>
          </div>
        )}

        {tokenBalance > 0 || isRefundable ? (
          <div
            id="mission-redeem-container"
            className="p-2 bg-darkest-cool rounded-2xl flex flex-col gap-4"
          >
            {tokenBalance > 0 && (
              <div>
                <h3 className="opacity-60 text-sm">Your Balance</h3>
                <p className="text-xl">{`${formatTokenAmount(
                  tokenBalance,
                  2
                )} $${token?.tokenSymbol}`}</p>
              </div>
            )}
            {isRefundable && (tokenBalance > 0 || tokenCredit > 0) && (
              <>
                <PrivyWeb3Button
                  id="redeem-button"
                  className="w-full rounded-full py-2"
                  label="Redeem"
                  action={redeem}
                  noPadding
                />
                <p className="mt-2 text-sm opacity-60">
                  This mission did not reach its funding goal. You can claim
                  your refund here.
                </p>
              </>
            )}
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  )
}

export type MissionPayRedeemProps = {
  mission: any
  token: any
  teamNFT: any
  stage: any
  onlyModal?: boolean
  modalEnabled?: boolean
  setModalEnabled?: (enabled: boolean) => void
  primaryTerminalAddress: string
  jbControllerContract?: any
  jbTokensContract?: any
  forwardClient?: any
  refreshBackers?: () => void
}

export default function MissionPayRedeem({
  mission,
  token,
  teamNFT,
  stage,
  onlyModal = false,
  modalEnabled = false,
  setModalEnabled,
  primaryTerminalAddress,
  jbControllerContract,
  jbTokensContract,
  forwardClient,
  refreshBackers,
}: MissionPayRedeemProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const chainSlug = getChainSlug(selectedChain)
  const router = useRouter()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN != 'mainnet'
  const chains = isTestnet
    ? [sepolia, optimismSepolia]
    : [arbitrum, base, ethereum]

  const [missionPayModalEnabled, setMissionPayModalEnabled] = useState(false)
  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)

  const account = useActiveAccount()
  const address = account?.address

  const [input, setInput] = useState('')
  const [output, setOutput] = useState(0)
  const [message, setMessage] = useState('')

  // USD input state and handlers
  const [usdInput, setUsdInput] = useState('')
  const { data: ethUsdPrice, isLoading: isLoadingEthUsdPrice } = useETHPrice(
    1,
    'ETH_TO_USD'
  )

  // Calculate ETH amount from USD for display
  const calculateEthAmount = useCallback(() => {
    if (!usdInput || !ethUsdPrice || isNaN(Number(usdInput))) {
      return '0.0000'
    }
    const ethAmount = (Number(usdInput) / ethUsdPrice).toFixed(4)
    return parseFloat(ethAmount).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }, [usdInput, ethUsdPrice])

  // Format number with commas
  const formatWithCommas = useCallback((value: string) => {
    if (!value) return ''
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return num.toLocaleString('en-US')
  }, [])

  // Format token amount with commas
  const formatTokenAmount = useCallback(
    (value: number, decimals: number = 2) => {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    },
    []
  )

  // Get formatted display value
  const formattedUsdInput = formatWithCommas(usdInput)

  // When USD input changes, update ETH input
  const handleUsdInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value.replace(/[^0-9]/g, '') // Only allow numbers

      // Limit to 7 characters (excluding commas)
      if (inputValue.length > 7) return

      setUsdInput(inputValue)
      if (inputValue === '') {
        setInput('0')
        return
      }
      if (ethUsdPrice && !isNaN(Number(inputValue))) {
        setInput((Number(inputValue) / ethUsdPrice).toFixed(6))
      } else {
        setInput('0')
      }
    },
    [ethUsdPrice, setInput]
  )

  const [isTeamSigner, setIsTeamSigner] = useState(false)
  // Use default chain for safe so that cross chain payments don't update safe chain
  const { safe, queueSafeTx, lastSafeTxExecuted } = useSafe(
    teamNFT?.owner,
    DEFAULT_CHAIN_V5
  )

  const { fundWallet } = useFundWallet()
  const [agreedToCondition, setAgreedToCondition] = useState(false)

  const currentStage = useMissionFundingStage(mission?.id)

  const primaryTerminalContract = useContract({
    address: primaryTerminalAddress,
    chain: DEFAULT_CHAIN_V5,
    abi: JBMultiTerminalABI as any,
    forwardClient,
  })

  const crossChainPayContract = useContract({
    address: MISSION_CROSS_CHAIN_PAY_ADDRESS,
    chain: selectedChain,
    abi: MISSION_CROSS_CHAIN_PAY_ABI.abi as any,
    forwardClient,
  })

  const nativeBalance = useNativeBalance()
  const tokenBalance = useWatchTokenBalance(
    selectedChain,
    token?.tokenAddress || JB_NATIVE_TOKEN_ADDRESS
  )
  const { data: tokenCredit } = useRead({
    contract: jbTokensContract,
    method: 'creditBalanceOf' as string,
    params: [address, mission?.projectId],
  })

  //check if the connected wallet is a signer of the team's multisig
  useEffect(() => {
    const isSigner = async () => {
      const isSigner = await safe?.isOwner(address || '')
      setIsTeamSigner(isSigner || false)
    }
    if (safe && address) isSigner()
  }, [safe, address])

  const getQuote = useCallback(async () => {
    if (!address) return
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }

    try {
      const inputValue = parseFloat(input) || 0
      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'pay' as string,
        params: [
          mission?.projectId,
          JB_NATIVE_TOKEN_ADDRESS,
          BigInt(Math.trunc(inputValue * 1e18)),
          address || ZERO_ADDRESS,
          0,
          message,
          '0x00',
        ],
        value: BigInt(Math.trunc(inputValue * 1e18)),
      })

      const q = await simulateTransaction({
        transaction,
      })
      setOutput(q.toString() / 1e18)
    } catch (error) {
      console.error('Error getting quote:', error)
      setOutput(0)
    }
  }, [primaryTerminalContract, input, address, mission?.projectId, message])

  const buyMissionToken = useCallback(async () => {
    if (!account || !address) {
      console.error('No account or address available')
      return
    }
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }
    if (!agreedToCondition) {
      toast.error('Please agree to the terms.', {
        style: toastStyle,
      })
      return
    }

    const inputValue = parseFloat(input) || 0
    if (inputValue <= 0) {
      toast.error('Please enter a valid amount.', {
        style: toastStyle,
      })
      return
    }
    if (inputValue > +nativeBalance) {
      return fundWallet(address, {
        amount: (inputValue - +nativeBalance).toString(),
        chain: viemChains[chainSlug],
      })
    }

    try {
      if (chainSlug !== defaultChainSlug) {
        const quoteCrossChainPay: any = await readContract({
          contract: crossChainPayContract,
          method: 'quoteCrossChainPay' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
            BigInt(Math.trunc(inputValue * 1e18)),
            mission?.projectId,
            address || ZERO_ADDRESS,
            output * 1e18,
            message,
            '0x00',
          ],
        })
        const transaction = prepareContractCall({
          contract: crossChainPayContract,
          method: 'crossChainPay' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[chainSlug].toString(),
            mission?.projectId,
            BigInt(Math.trunc(inputValue * 1e18)),
            address || ZERO_ADDRESS,
            output * 0, // Don't put in mininum output for cross-chain pay to account for slippage
            message,
            '0x00',
          ],
          value: BigInt(quoteCrossChainPay),
        })

        const originReceipt: any = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        const destinationMessage = await waitForMessageReceived(
          isTestnet ? 19999 : 1, // 19999 resolves to testnet, 1 to mainnet, see https://cdn.jsdelivr.net/npm/@layerzerolabs/scan-client@0.0.8/dist/client.mjs
          originReceipt.transactionHash
        )
        const receipt = await waitForReceipt({
          client: client,
          chain: DEFAULT_CHAIN_V5,
          transactionHash: destinationMessage.dstTxHash as `0x${string}`,
        })
      } else {
        const transaction = prepareContractCall({
          contract: primaryTerminalContract,
          method: 'pay' as string,
          params: [
            mission?.projectId,
            JB_NATIVE_TOKEN_ADDRESS,
            BigInt(Math.trunc(inputValue * 1e18)),
            address,
            output * 1e18,
            message,
            '0x00',
          ],
          value: BigInt(Math.trunc(inputValue * 1e18)),
          gas: BigInt(500000),
        })

        const receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }

      toast.success('Mission token purchased.', {
        style: toastStyle,
      })

      refreshBackers?.()
      setMissionPayModalEnabled(false)
      router.reload()
    } catch (error) {
      console.error('Error purchasing tokens:', error)
      toast.error('Failed to purchase tokens', {
        style: toastStyle,
      })
    }
  }, [
    account,
    primaryTerminalContract,
    mission?.projectId,
    input,
    address,
    output,
    message,
    router,
    nativeBalance,
    chainSlug,
    agreedToCondition,
  ])

  //Redeem (stage 3 refund) all mission tokens for the connected wallet
  const redeemMissionToken = useCallback(async () => {
    if (!account || !address) {
      console.error('No account or address available')
      return
    }
    if (!primaryTerminalContract) {
      console.error('Primary terminal contract not initialized')
      return
    }

    if (tokenBalance < 0) {
      toast.error('You have no tokens to redeem.', {
        style: toastStyle,
      })
      return
    }

    try {
      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'cashOutTokensOf' as string,
        params: [
          address,
          mission?.projectId,
          tokenBalance * 1e18 || tokenCredit.toString(),
          JB_NATIVE_TOKEN_ADDRESS,
          tokenBalance * 1e18 || tokenCredit.toString(),
          address,
          '',
        ],
        gas: BigInt(500000),
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      toast.success('Tokens redeemed successfully!', {
        style: toastStyle,
      })
      router.reload()
    } catch (error: any) {
      console.error('Error redeeming tokens:', error)
      if (error.message.includes('Project funding deadline has not passed.')) {
        toast.error(
          'Mission funding deadline has not passed. Refunds are disabled.',
          {
            style: toastStyle,
          }
        )
      } else {
        toast.error('Failed to redeem tokens.', {
          style: toastStyle,
        })
      }
    }
  }, [
    account,
    primaryTerminalContract,
    address,
    mission?.projectId,
    router,
    tokenBalance,
  ])

  //Claim all token credit for the connected wallet
  const claimTokenCredit = useCallback(async () => {
    if (!account || !address) {
      console.error('No account or address available')
      return
    }

    if (tokenCredit <= 0) {
      toast.error('You have no token credit to claim.', {
        style: toastStyle,
      })
      return
    }

    try {
      const transaction = prepareContractCall({
        contract: jbControllerContract,
        method: 'claimTokensFor' as string,
        params: [address, mission?.projectId, tokenCredit, address],
        gas: BigInt(500000),
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      toast.success('Token credit claimed successfully!', {
        style: toastStyle,
      })
      router.reload()
    } catch (error) {
      console.error('Error claiming token credit:', error)
      toast.error('Failed to claim token credit.', {
        style: toastStyle,
      })
    }
  }, [account, address, jbTokensContract, mission?.projectId, tokenCredit])

  useEffect(() => {
    if (parseFloat(input) > 0) {
      getQuote()
    } else if (input === '0' || input === '') {
      setOutput(0)
    }
  }, [input])

  return (
    <>
      {!onlyModal && (
        <>
          {deployTokenModalEnabled && isTeamSigner && (
            <MissionDeployTokenModal
              setEnabled={setDeployTokenModalEnabled}
              isTeamSigner={isTeamSigner}
              queueSafeTx={queueSafeTx}
              mission={mission}
              chainSlug={chainSlug}
              teamMutlisigAddress={teamNFT?.owner}
              lastSafeTxExecuted={lastSafeTxExecuted}
            />
          )}
          {token &&
            (!token?.tokenAddress || token.tokenAddress === '') &&
            isTeamSigner &&
            stage !== 3 && (
              <div className="p-8 md:p-0 flex md:block justify-center">
                <StandardButton
                  id="deploy-token-button"
                  className="gradient-2 rounded-full w-full max-w-[300px]"
                  hoverEffect={false}
                  onClick={() => setDeployTokenModalEnabled(true)}
                >
                  Deploy Token
                </StandardButton>
              </div>
            )}
          <div className="mt-2">
            <MissionPayRedeemContent
              token={token}
              output={output}
              redeem={redeemMissionToken}
              setMissionPayModalEnabled={setMissionPayModalEnabled}
              tokenBalance={tokenBalance}
              tokenCredit={tokenCredit !== undefined ? tokenCredit : 0}
              claimTokenCredit={claimTokenCredit}
              currentStage={currentStage}
              stage={stage}
              handleUsdInputChange={handleUsdInputChange}
              calculateEthAmount={calculateEthAmount}
              formattedUsdInput={formattedUsdInput}
              formatTokenAmount={formatTokenAmount}
            />
          </div>
        </>
      )}
      {(modalEnabled || missionPayModalEnabled) && (
        <Modal id="mission-pay-modal" setEnabled={setMissionPayModalEnabled}>
          <div className="mt-12 w-screen h-full rounded-[2vmax] max-w-[500px] flex flex-col gap-4 items-start justify-start p-5 bg-gradient-to-b from-dark-cool to-darkest-cool">
            <div className="w-full flex gap-4 items-start justify-between">
              <h3 className="text- font-GoodTimes">{`Contribute to ${mission?.metadata?.name}`}</h3>
              <button
                type="button"
                className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={(e: any) => {
                  setModalEnabled
                    ? setModalEnabled(false)
                    : setMissionPayModalEnabled(false)
                }}
              >
                <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>

            <div className="w-full flex justify-between">
              <p>{'Total Amount'}</p>
              <div className="flex gap-2 items-center bg-moon-indigo/20 rounded-full px-3 py-1">
                <Image
                  src="/coins/ETH.svg"
                  alt="ETH"
                  width={16}
                  height={16}
                  className="w-5 h-5 bg-light-cool rounded-full"
                />
                <span className="text-base">{calculateEthAmount()} ETH</span>
              </div>
            </div>
            <div className="w-full flex justify-end">
              <div className="flex gap-2 items-center">
                <span>$</span>
                <input
                  id="payment-input"
                  type="text"
                  className="text-right bg-transparent w-[100px] rounded-md px-2 outline-none font-bold border-[1px] border-moon-indigo [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={formattedUsdInput}
                  onChange={handleUsdInputChange}
                  maxLength={9}
                />
                <span>{'USD'}</span>
              </div>
            </div>
            <hr className="w-full" />
            {token?.tokenSymbol && (
              <div className="w-full flex justify-between">
                <p>{'Receive'}</p>
                <p id="token-output">{`${formatTokenAmount(output, 2)} ${
                  token?.tokenSymbol
                }`}</p>
              </div>
            )}

            <div className="w-full flex items-center gap-2">
              <p>{`NFTs, tokens and rewards will be sent to:`}</p>
              <button
                className="p-1 px-4 flex items-center gap-2 bg-moon-indigo rounded-xl"
                onClick={(e: any) => {
                  navigator.clipboard.writeText(address || '')
                  toast.success('Address copied to clipboard.', {
                    style: toastStyle,
                  })
                }}
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
                <CopyIcon />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Image
                src={mission?.metadata.logoUri}
                width={100}
                height={100}
                className="rounded-full"
                alt={`${token?.tokenSymbol} logo`}
              />
              <p>{`${token?.tokenSymbol} (${token?.tokenName})`}</p>
            </div>

            <hr className="w-full" />

            <div className="w-full flex flex-col gap-4 justify-between">
              <p>{`Message (optional)`}</p>
              <input
                id="payment-message-input"
                type="text"
                className="w-full bg-darkest-cool border-moon-indigo border-[1px] rounded-xl p-2"
                placeholder="Attach an on-chain message to this payment"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={100}
              />
            </div>

            <MissionTokenNotice />

            <div>
              <ConditionCheckbox
                id="contribution-terms-checkbox"
                label={
                  <p className="text-sm">
                    {`I acknowledge that any token issued from this contribution is not a security, carries no profit expectation, and I accept all `}
                    <Link
                      href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                      className="text-moon-blue"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      risks
                    </Link>{' '}
                    {`associated with participation in the MoonDAO Launchpad.`}
                  </p>
                }
                agreedToCondition={agreedToCondition}
                setAgreedToCondition={setAgreedToCondition}
              />
            </div>

            <div className="w-full flex justify-between gap-4">
              <NetworkSelector chains={chains} compact={true} align="left" />
            </div>
            <div className="w-full flex justify-between gap-4">
              <StandardButton
                styleOnly
                className="w-1/2 p-2 text-center border-moon-indigo border-[1px] rounded-xl"
                onClick={() => {
                  setModalEnabled
                    ? setModalEnabled(false)
                    : setMissionPayModalEnabled(false)
                }}
                hoverEffect={false}
              >
                Cancel
              </StandardButton>
              <PrivyWeb3Button
                id="contribute-button"
                className="w-1/2 bg-moon-indigo rounded-xl"
                label={`Contribute $${formattedUsdInput || '0'} USD`}
                action={buyMissionToken}
                isDisabled={
                  !agreedToCondition || !usdInput || parseFloat(usdInput) <= 0
                }
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
