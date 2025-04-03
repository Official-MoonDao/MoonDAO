import { ArrowDownIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { nativeOnChain } from '@uniswap/smart-order-router'
import JBMultiTerminalABI from 'const/abis/JBV4MultiTerminal.json'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import { pregenSwapRoute } from '@/lib/uniswap/pregenSwapRoute'
import { CopyIcon } from '../assets'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
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
}: any) {
  return (
    <div
      id="mission-pay-redeem-container"
      className="w-full flex flex-row flex-col md:flex-row xl:flex-col gap-4 xl:max-w-[300px]"
    >
      <div
        id="mission-pay-container"
        className="p-2 max-w-[300px] flex flex-col gap-4 bg-[#020617] rounded-2xl justify-between"
      >
        <div id="mission-pay-header" className="flex justify-between gap-2">
          <PayRedeemStat label="Payments" value={subgraphData?.paymentsCount} />
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
        <div className="relative flex flex-col gap-4">
          <div className="p-4 pb-12 flex items-center justify-between bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-tl-2xl rounded-tr-2xl">
            <div className="flex flex-col">
              <h3 className="text-sm opacity-60">You pay</h3>
              <input
                type="number"
                className="w-full bg-transparent border-none outline-none text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={input}
                onChange={(e) => setInput(+e.target.value)}
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
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex items-center justify-center">
            <ArrowDownIcon
              className="p-2 w-12 h-12 bg-darkest-cool rounded-full"
              color={'#121C42'}
            />
          </div>
          {/* You receive */}
          <div className="p-4 pb-12 flex items-center justify-between bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-bl-2xl rounded-br-2xl">
            <div className="flex flex-col">
              <h3 className="text-sm opacity-60">You receive</h3>
              <p className="text-2xl font-bold">{output}</p>
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
        </div>
        <StandardButton
          className="rounded-full gradient-2 rounded-full w-full py-1"
          onClick={() => setMissionPayModalEnabled(true)}
          hoverEffect={false}
        >
          Pay
        </StandardButton>
      </div>
      {/* Token stats and redeem container */}
      <div className="xl:pt-4 flex flex-col justify-between gap-4">
        <div
          id="mission-token-stats"
          className="px-2 pt-1 bg-darkest-cool rounded-2xl"
        >
          <div className="text-lg">
            <h3 className="opacity-60 text-sm">Current Supply</h3>
            <p>
              {token?.tokenSupply.toString() / 1e18} {token?.tokenSymbol}
            </p>
          </div>

          <MissionTokenExchangeRates
            ruleset={ruleset}
            tokenSymbol={token?.tokenSymbol}
          />
        </div>
        <div
          id="mission-redeem-container"
          className="p-2 bg-darkest-cool rounded-2xl flex flex-col gap-4"
        >
          <div>
            <h3 className="opacity-60 text-sm">Your Balance</h3>
            <p className="text-2xl">{`${tokenBalance} ${token?.tokenSymbol}`}</p>
          </div>

          <PrivyWeb3Button
            className="w-full rounded-full py-2"
            label="Redeem"
            action={redeem}
            noPadding
          />
        </div>
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
  ruleset: any
  onlyModal?: boolean
  modalEnabled?: boolean
  setModalEnabled?: (enabled: boolean) => void
  primaryTerminalAddress: string
}

export default function MissionPayRedeem({
  selectedChain,
  mission,
  token,
  fundingGoal,
  subgraphData,
  teamNFT,
  ruleset,
  onlyModal = false,
  modalEnabled = false,
  setModalEnabled,
  primaryTerminalAddress,
}: MissionPayRedeemProps) {
  const router = useRouter()
  const [missionPayModalEnabled, setMissionPayModalEnabled] = useState(false)
  const account = useActiveAccount()
  const address = account?.address
  const [input, setInput] = useState(0)
  const [output, setOutput] = useState(0)
  const [message, setMessage] = useState('')

  const [usdQuote, setUSDQuote] = useState<number | undefined>(0)

  const [agreedToCondition, setAgreedToCondition] = useState(false)

  const primaryTerminalContract = useContract({
    address: primaryTerminalAddress,
    chain: selectedChain,
    abi: JBMultiTerminalABI as any,
  })

  const tokenBalance = useWatchTokenBalance(selectedChain, token?.tokenAddress)

  const buyMissionToken = useCallback(async () => {
    if (!account) return

    try {
      const transaction = prepareContractCall({
        contract: primaryTerminalContract,
        method: 'pay' as string,
        params: [
          mission?.projectId,
          '0x000000000000000000000000000000000000EEEe',
          input * 1e18,
          address,
          output,
          message,
          '0x00',
        ],
        value: BigInt(input * 1e18),
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
  ])

  const redeemMissionToken = useCallback(async () => {
    if (!account) return
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
          '0x0',
        ],
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
  }, [account, primaryTerminalContract, address, mission?.projectId, router])

  const { DAI } = useUniswapTokens(ethereum)

  useEffect(() => {
    async function getUSDQuote() {
      setUSDQuote(undefined)
      const route = await pregenSwapRoute(
        ethereum,
        input,
        nativeOnChain(ethereum.id),
        DAI
      )
      setUSDQuote(route?.route[0]?.rawQuote.toString() / 1e18)
    }
    if (input > 0 && ruleset) {
      const output = input * (+ruleset?.[0].weight.toString() / 1e18)
      console.log(mission)
      setOutput(output)
    }
    if (input > 0) {
      getUSDQuote()
    }
  }, [input, ruleset, DAI])

  return (
    <>
      {!onlyModal && (
        <>
          <div className="hidden md:block">
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
            />
          </div>
          <div className="fixed bottom-0 left-0 w-full p-4 bg-darkest-cool rounded-t-2xl md:hidden z-[1000] flex flex-col gap-4">
            <StandardButton
              className="w-full gradient-2 rounded-full text-lg"
              onClick={() => setMissionPayModalEnabled(true)}
              hoverEffect={false}
            >
              Pay
            </StandardButton>
            <PrivyWeb3Button
              label="Redeem"
              className="w-full gradient-2 rounded-full py-2"
              action={redeemMissionToken}
              noPadding
            />
          </div>
        </>
      )}
      {(modalEnabled || missionPayModalEnabled) && (
        <Modal id="mission-pay-modal" setEnabled={setMissionPayModalEnabled}>
          <div className="mt-12 w-screen h-full rounded-[2vmax] max-w-[500px] flex flex-col gap-4 items-start justify-start p-5 bg-gradient-to-b from-dark-cool to-darkest-cool">
            <div className="w-full flex gap-4 items-start justify-between">
              <h3 className="text- font-GoodTimes">{`Pay ${teamNFT?.metadata?.name}`}</h3>
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
              <p>{'Total Amont'}</p>
              <div className="flex flex-col lg:flex-row gap-2 items-end lg:items-center">
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    className="text-right bg-transparent border-none outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={input}
                    onChange={(e) => setInput(+e.target.value)}
                  />
                  {'ETH'}
                </div>
                {usdQuote !== undefined ? (
                  <p className="opacity-60">{`(USD ~$${usdQuote.toLocaleString()})`}</p>
                ) : (
                  <div className="scale-[75%]">
                    <LoadingSpinner />
                  </div>
                )}
              </div>
            </div>
            <hr className="w-full" />
            <div className="w-full flex justify-between">
              <p>{'Receive'}</p>
              <p>{`${output.toLocaleString()} ${token?.tokenSymbol}`}</p>
            </div>

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
                type="text"
                className="w-full bg-darkest-cool border-moon-indigo border-[1px] rounded-xl p-2"
                placeholder="Attach an on-chain message to this payment"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <MissionTokenNotice />

            <div>
              <ConditionCheckbox
                label={
                  <p className="text-sm">
                    {`I understand and accept this project's notice and the `}
                    <Link
                      href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                      className="text-moon-blue"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      risks
                    </Link>{' '}
                    {`associated with the Juicebox protocol.`}
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
              >
                Cancel
              </StandardButton>
              <PrivyWeb3Button
                className="w-1/2 bg-moon-indigo rounded-xl"
                label={`Pay ${input} ETH`}
                action={buyMissionToken}
                isDisabled={!agreedToCondition}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
