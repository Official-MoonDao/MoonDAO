import { useFundWallet } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import viemChains from '@/lib/viem/viemChains'
import { LoadingSpinner } from '../../components/layout/LoadingSpinner'

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
  noTxns?: boolean
  nativeAmount?: any
  extraFundsForGas?: any
}

export function Step({
  realStep,
  stepNum,
  title,
  explanation,
  action,
  isDisabled,
  txExplanation,
  selectedChain,
  selectedWallet,
  wallets,
  noTxns,
  nativeAmount,
  extraFundsForGas,
}: StepProps) {
  const [isProcessingTx, setIsProcessingTx] = useState(false)

  const { fundWallet } = useFundWallet()

  const nativeTokenName = useMemo(() => {
    let tokenName
    if (selectedChain.slug === 'ethereum') {
      tokenName = 'ETH'
    } else if (selectedChain.slug === 'polygon') {
      tokenName = 'MATIC'
    } else if (selectedChain.slug === 'arbitrum') {
      tokenName = 'ETH'
    }
    return tokenName
  }, [selectedChain])

  const stepButtons = useMemo(() => {
    switch (realStep) {
      case 1:
        return (
          <>
            <button
              className="my-2 w-[100%] h-auto p-3 space-y-2 hover:scale-105 duration-300 ease-in-out px-8 py-2 text-black dark:text-white text-base font-normal font-['Roboto Mono'] dark:bg-[#FFFFFF14] bg-[#00000025]"
              onClick={async () => {
                const wallet = wallets[selectedWallet]
                if (!wallet) return
                const provider = await wallet.getEthersProvider()
                const nativeBalance = await provider.getBalance(wallet.address)
                const formattedNativeBalance =
                  ethers.utils.formatEther(nativeBalance)
                const levelPrice = nativeAmount + extraFundsForGas

                await fundWallet(wallet.address, {
                  amount: String(
                    Math.ceil((levelPrice - +formattedNativeBalance) * 100000) /
                      100000
                  ),
                  chain: viemChains[selectedChain.slug],
                })
              }}
              disabled={isDisabled || isProcessingTx}
            >
              {isProcessingTx ? (
                <LoadingSpinner></LoadingSpinner>
              ) : isDisabled ? (
                <LoadingSpinner>{'...loading'}</LoadingSpinner>
              ) : (
                `Purchase ${nativeTokenName} with MoonPay`
              )}
            </button>
            <button
              className="my-2 w-[100%] h-auto p-3 space-y-2 hover:scale-105 duration-300 ease-in-out px-8 py-2 text-black dark:text-white text-base font-normal font-['Roboto Mono'] dark:bg-[#FFFFFF14] bg-[#00000025]"
              onClick={async () => {
                //check network
                if (
                  +wallets[selectedWallet].chainId.split(':')[1] !==
                  +selectedChain.chainId
                ) {
                  return toast.error(
                    `Please switch wallet to ${selectedChain.name}.`
                  )
                }

                try {
                  setIsProcessingTx(true)
                  await action()
                  if (noTxns) {
                    setIsProcessingTx(false)
                  }
                } catch (err: any) {
                  toast.error(err.message.slice(0, 150))
                  setIsProcessingTx(false)
                }
              }}
              disabled={isDisabled || isProcessingTx}
            >
              {isProcessingTx ? (
                <LoadingSpinner></LoadingSpinner>
              ) : isDisabled ? (
                <LoadingSpinner>{'...loading'}</LoadingSpinner>
              ) : (
                `Purchase ${nativeTokenName} with Exchange`
              )}
            </button>
          </>
        )
      case 2:
        return (
          <button
            className="my-2 w-[100%] h-auto p-3 space-y-2 hover:scale-105 duration-300 ease-in-out px-8 py-2 text-black dark:text-white text-base font-normal font-['Roboto Mono'] dark:bg-[#FFFFFF14] bg-[#00000025]"
            onClick={async () => {
              //check network
              if (
                +wallets[selectedWallet].chainId.split(':')[1] !==
                +selectedChain.chainId
              ) {
                return toast.error(
                  `Please switch wallet to ${selectedChain.name}.`
                )
              }

              try {
                setIsProcessingTx(true)
                await action()
                if (noTxns) {
                  setIsProcessingTx(false)
                }
              } catch (err: any) {
                toast.error(err.message.slice(0, 150))
                setIsProcessingTx(false)
              }
            }}
            disabled={isDisabled || isProcessingTx}
          >
            {isProcessingTx ? (
              <LoadingSpinner></LoadingSpinner>
            ) : isDisabled ? (
              <LoadingSpinner>{'...loading'}</LoadingSpinner>
            ) : (
              'Swap MATIC'
            )}
          </button>
        )
      case 3:
        return (
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

              try {
                setIsProcessingTx(true)
                await action()
                if (noTxns) {
                  setIsProcessingTx(false)
                }
              } catch (err: any) {
                toast.error(err.message.slice(0, 150))
                setIsProcessingTx(false)
              }
            }}
            disabled={isDisabled || isProcessingTx}
          >
            {isProcessingTx ? (
              <LoadingSpinner></LoadingSpinner>
            ) : isDisabled ? (
              <LoadingSpinner>{'...loading'}</LoadingSpinner>
            ) : (
              'Start Token Approval'
            )}
          </button>
        )
      case 4:
        return (
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

              try {
                setIsProcessingTx(true)
                await action()
                if (noTxns) {
                  setIsProcessingTx(false)
                }
              } catch (err: any) {
                toast.error(err.message.slice(0, 150))
                setIsProcessingTx(false)
              }
            }}
            disabled={isDisabled || isProcessingTx}
          >
            {isProcessingTx ? (
              <LoadingSpinner></LoadingSpinner>
            ) : isDisabled ? (
              <LoadingSpinner>{'...loading'}</LoadingSpinner>
            ) : (
              'Stake $MOONEY'
            )}
          </button>
        )
      default:
        return (
          <button
            className="my-2 w-[100%] h-auto p-3 space-y-2 hover:scale-105 duration-300 ease-in-out px-8 py-2 text-black dark:text-white text-base font-normal font-['Roboto Mono'] dark:bg-[#FFFFFF14] bg-[#00000025]"
            onClick={async () => {
              //check network
              if (
                +wallets[selectedWallet].chainId.split(':')[1] !==
                +selectedChain.chainId
              ) {
                return toast.error(
                  `Please switch wallet to ${selectedChain.name}.`
                )
              }

              try {
                setIsProcessingTx(true)
                await action()
                if (noTxns) {
                  setIsProcessingTx(false)
                }
              } catch (err: any) {
                toast.error(err.message.slice(0, 150))
                setIsProcessingTx(false)
              }
            }}
            disabled={isDisabled || isProcessingTx}
          >
            {isProcessingTx ? (
              <LoadingSpinner></LoadingSpinner>
            ) : isDisabled ? (
              <LoadingSpinner>{'...loading'}</LoadingSpinner>
            ) : (
              'Start'
            )}
          </button>
        )
    }
  }, [
    action,
    extraFundsForGas,
    fundWallet,
    isDisabled,
    isProcessingTx,
    nativeAmount,
    nativeTokenName,
    noTxns,
    realStep,
    selectedChain.chainId,
    selectedChain.name,
    selectedChain.slug,
    selectedWallet,
    wallets,
  ])

  return (
    <div className="mt-5 w-full h-full text-black dark:text-white">
      <div className="flex flex-col text-left lg:flex-row lg:text-left lg:gap-5 lg:w-full lg:h-full p-4 lg:p-6 border border-gray-500 dark:border-white dark:border-opacity-[0.18]">
        <p
          className={`block px-3 py-1 h-10 w-10 flex justify-center items-center text-xl font-bold rounded-[9999px] ${
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
          <div className="mt-[15px] text-left block lg:mt-0 xl:text-xl w-[150px]">
            {title}
          </div>
        </div>
        <div className="mt-1 opacity-60 text-base font-normal lg:mt-0 xl:text-base font-[Lato]">
          {explanation}
        </div>

        {realStep === stepNum && txExplanation && <p>{txExplanation}</p>}
        {/*Previously was a border-4 class on hover for this button but changed it for scale, as increasing border expands the whole container on hover*/}
      </div>
      {realStep === stepNum && stepButtons}
    </div>
  )
}
