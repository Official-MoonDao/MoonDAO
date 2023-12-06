import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '../layout/LoadingSpinner'

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
}: StepProps) {
  const [isProcessingTx, setIsProcessingTx] = useState(false)

  return (
    <div className="mt-5 w-full h-full text-black dark:text-white">
      <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-5 lg:w-full lg:h-full p-2 lg:p-3 border border-gray-500 dark:border-white dark:border-opacity-[0.18]">
        <p
          className={`block px-3 py-1 text-xl font-bold rounded-[9999px] ${realStep === stepNum
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
      )}
    </div>
  )
}
