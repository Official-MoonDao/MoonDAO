import { ArrowDownIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useFundWallet } from '@privy-io/react-auth'
import JBMultiTerminalABI from 'const/abis/JBV4MultiTerminal.json'
import { JB_NATIVE_TOKEN_ADDRESS } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  simulateTransaction,
  ZERO_ADDRESS,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useMissionFundingStage from '@/lib/mission/useMissionFundingStage'
import useSafe from '@/lib/safe/useSafe'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import useRead from '@/lib/thirdweb/hooks/useRead'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import viemChains from '@/lib/viem/viemChains'
import { CopyIcon } from '../assets'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionDeployTokenModal from './MissionDeployTokenModal'
import MissionTokenExchangeRates from './MissionTokenExchangeRates'
import MissionTokenNotice from './MissionTokenNotice'

function PayRedeemStat({ label, value, children }: any) {
  return (
    <div className="font-GoodTimes w-1/3 flex flex-col">
      <h3 className="opacity-60 text-[60%]">{label}</h3>
      <p>{value}</p>
      {children}
    </div>
  )
}

function MissionPayRedeemContent({
  token,
  ruleset,
  subgraphData,
  input,
  output,
  setInput,
  redeem,
  setMissionPayModalEnabled,
  tokenBalance,
  currentStage,
  stage,
  tokenCredit,
  claimTokenCredit,
}: any) {
  const isRefundable = stage === 3 && subgraphData?.volume > 0

  return (
    <div
      id="mission-pay-redeem-container"
      className="w-full flex flex-row flex-col md:flex-row xl:flex-col gap-4 xl:max-w-[300px] items-center"
    >
      <div
        id="mission-pay-container"
        className="p-2 max-w-[500px] md:max-w-[300px] flex flex-col gap-4 bg-[#020617] rounded-2xl justify-between"
      >
        <div id="mission-pay-header" className="flex justify-between gap-2">
          <PayRedeemStat
            label="Contributions"
            value={subgraphData?.paymentsCount}
          />
          <PayRedeemStat
            label="Total Raised"
            value={subgraphData?.volume / 1e18}
          />
          <PayRedeemStat label="Last 7 Days">
            <div className="flex items-center gap-1">
              <Image
                src="/assets/launchpad/upwards.svg"
                alt="increase"
                width={30}
                height={30}
              />
              <p className="text-moon-green">{`${
                subgraphData?.last7DaysPercent === Infinity
                  ? '0'
                  : subgraphData?.last7DaysPercent
              }%`}</p>
            </div>
          </PayRedeemStat>
        </div>
        {/* You pay */}
        {!isRefundable && (
          <div className="relative flex flex-col gap-4">
            <div
              className={`p-4 pb-12 flex items-center justify-between bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-tl-2xl rounded-tr-2xl ${
                token?.tokenSymbol ? '' : 'rounded-bl-2xl rounded-br-2xl'
              }`}
            >
              <div className="flex flex-col">
                <h3 className="text-sm opacity-60">You contribute</h3>
                <input
                  id="payment-input"
                  type="number"
                  className="w-full bg-transparent border-none outline-none text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-center bg-[#111C42] rounded-full p-1 px-2">
                <Image
                  src="/coins/ETH.svg"
                  alt="ETH"
                  width={20}
                  height={20}
                  className="w-12 h-5 bg-light-cool rounded-full"
                />
                {'ETH'}
              </div>
            </div>
            {token?.tokenSymbol && (
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex items-center justify-center">
                <ArrowDownIcon
                  className="p-2 w-12 h-12 bg-darkest-cool rounded-full"
                  color={'#121C42'}
                />
              </div>
            )}
            {/* You receive */}
            {token?.tokenSymbol && (
              <div className="p-4 pb-12 flex items-center justify-between bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-bl-2xl rounded-br-2xl">
                <div className="flex flex-col">
                  <h3 className="text-sm opacity-60">You receive</h3>
                  <p id="token-output" className="text-2xl font-bold">
                    {output.toFixed(2)}
                  </p>
                </div>
                <div className="relative flex gap-2 items-center bg-[#111C42] rounded-full p-1 px-2">
                  <Image
                    src="/assets/icon-star.svg"
                    alt="ETH"
                    width={20}
                    height={20}
                    className="bg-orange-500 rounded-full p-1w-5 h-5"
                  />
                  <Image
                    src="/coins/ETH.svg"
                    alt="ETH"
                    width={20}
                    height={20}
                    className="absolute bottom-0 left-1/4 -translate-x-1/4 w-3 h-3 bg-light-cool rounded-full"
                  />
                  {token?.tokenSymbol}
                </div>
              </div>
            )}
          </div>
        )}
        {!isRefundable && (
          <StandardButton
            id="open-contribute-modal"
            className="rounded-full gradient-2 rounded-full w-full py-1"
            onClick={() => setMissionPayModalEnabled(true)}
            hoverEffect={false}
          >
            Contribute
          </StandardButton>
        )}
        {token?.tokenSymbol && +tokenCredit?.toString() > 0 && (
          <StandardButton
            id="claim-button"
            className="rounded-full gradient-2 rounded-full w-full py-1"
            onClick={claimTokenCredit}
            hoverEffect={false}
          >
            Claim {tokenCredit.toString() / 1e18} ${token?.tokenSymbol}
          </StandardButton>
        )}
      </div>
      {/* Token stats and redeem container */}
      <div className="xl:pt-4 flex flex-col justify-between gap-4">
        {token?.tokenSupply > 0 && !isRefundable && (
          <div
            id="mission-token-stats"
            className="px-2 pt-1 bg-darkest-cool rounded-2xl"
          >
            <div className="text-lg">
              <h3 className="opacity-60 text-sm">Current Supply</h3>
              <p>
                {Math.floor(token?.tokenSupply.toString() / 1e18)} $
                {token?.tokenSymbol}
              </p>
            </div>

            <MissionTokenExchangeRates
              currentStage={currentStage}
              tokenSymbol={token?.tokenSymbol}
            />
          </div>
        )}
        {tokenBalance > 0 && isRefundable && (
          <div
            id="mission-redeem-container"
            className="p-2 bg-darkest-cool rounded-2xl flex flex-col gap-4"
          >
            <div>
              <h3 className="opacity-60 text-sm">Your Balance</h3>
              <p className="text-2xl">{`${tokenBalance.toFixed(2)} $${
                token?.tokenSymbol
              }`}</p>
            </div>

            <PrivyWeb3Button
              id="redeem-button"
              className="w-full rounded-full py-2"
              label="Redeem"
              action={redeem}
              noPadding
            />
            <p className="mt-2 text-sm opacity-60">
              This mission did not reach its funding goal. You can redeem your
              tokens for ETH.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export type MissionPayRedeemProps = {
  selectedChain: any
  mission: any
  token: any
  fundingGoal: number
  subgraphData: any
  teamNFT: any
  stage: any
  ruleset: any
  onlyModal?: boolean
  modalEnabled?: boolean
  setModalEnabled?: (enabled: boolean) => void
  primaryTerminalAddress: string
  jbControllerContract?: any
  jbTokensContract?: any
  forwardClient?: any
}

export default function MissionPayRedeem({
  selectedChain,
  mission,
  token,
  fundingGoal,
  subgraphData,
  teamNFT,
  stage,
  ruleset,
  onlyModal = false,
  modalEnabled = false,
  setModalEnabled,
  primaryTerminalAddress,
  jbControllerContract,
  jbTokensContract,
  forwardClient,
}: MissionPayRedeemProps) {
  const chainSlug = getChainSlug(selectedChain)
  const router = useRouter()

  const [missionPayModalEnabled, setMissionPayModalEnabled] = useState(false)
  const [deployTokenModalEnabled, setDeployTokenModalEnabled] = useState(false)

  const account = useActiveAccount()
  const address = account?.address

  const [input, setInput] = useState('0')
  const [output, setOutput] = useState(0)
  const [message, setMessage] = useState('')

  const [isTeamSigner, setIsTeamSigner] = useState(false)
  const { safe, queueSafeTx, lastSafeTxExecuted } = useSafe(teamNFT?.owner)

  const { fundWallet } = useFundWallet()
  const [agreedToCondition, setAgreedToCondition] = useState(false)

  const currentStage = useMissionFundingStage(mission?.id)

  const primaryTerminalContract = useContract({
    address: primaryTerminalAddress,
    chain: selectedChain,
    abi: JBMultiTerminalABI as any,
    forwardClient,
  })

  const nativeBalance = useNativeBalance()
  const tokenBalance = useWatchTokenBalance(selectedChain, token?.tokenAddress)
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
          inputValue * 1e18,
          address || ZERO_ADDRESS,
          0,
          message,
          '0x00',
        ],
        value: BigInt(inputValue * 1e18),
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
      toast.error('Please agree to the terms', {
        style: toastStyle,
      })
      return
    }

    const inputValue = parseFloat(input) || 0
    console.log(inputValue)
    if (inputValue <= 0) {
      toast.error('Please enter a valid amount', {
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
      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'pay' as string,
        params: [
          mission?.projectId,
          JB_NATIVE_TOKEN_ADDRESS,
          inputValue * 1e18,
          address,
          Math.floor(output),
          message,
          '0x00',
        ],
        value: BigInt(inputValue * 1e18),
        gas: BigInt(500000),
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      toast.success('Mission token purchased', {
        style: toastStyle,
      })

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
      toast.error('You have no tokens to redeem', {
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
          tokenBalance * 1e18 || 0,
          '0x000000000000000000000000000000000000EEEe',
          0,
          address,
          '',
        ],
        gas: BigInt(500000),
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      toast.success('Tokens redeemed successfully', {
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
        toast.error('Failed to redeem tokens', {
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
      toast.error('You have no token credit to claim', {
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

      toast.success('Token credit claimed successfully', {
        style: toastStyle,
      })
      router.reload()
    } catch (error) {
      console.error('Error claiming token credit:', error)
      toast.error('Failed to claim token credit', {
        style: toastStyle,
      })
    }
  }, [account, address, jbTokensContract, mission?.projectId, tokenCredit])

  useEffect(() => {
    if (parseFloat(input) > 0) {
      getQuote()
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
          {!token?.tokenSymbol && isTeamSigner && (
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
              ruleset={ruleset}
              subgraphData={subgraphData}
              input={input}
              output={output}
              redeem={redeemMissionToken}
              setInput={setInput}
              setMissionPayModalEnabled={setMissionPayModalEnabled}
              tokenBalance={tokenBalance}
              tokenCredit={tokenCredit !== undefined ? tokenCredit : 0}
              claimTokenCredit={claimTokenCredit}
              currentStage={currentStage}
              stage={stage}
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
              <div className="flex flex-col lg:flex-row gap-2 items-end lg:items-center">
                <div className="flex gap-2 items-center">
                  <input
                    id="payment-input"
                    type="number"
                    className="text-right bg-transparent w-[75px] rounded-md px-2 outline-none font-bold border-[1px] border-moon-indigo [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  {'ETH'}
                </div>
              </div>
            </div>
            <hr className="w-full" />
            {token?.tokenSymbol && (
              <div className="w-full flex justify-between">
                <p>{'Receive'}</p>
                <p id="token-output">{`${output.toFixed(2).toLocaleString()} ${
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
                  toast.success('Address copied to clipboard', {
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
                label={`Contribute ${input} ETH`}
                action={buyMissionToken}
                isDisabled={
                  !agreedToCondition || !input || parseFloat(input) <= 0
                }
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
