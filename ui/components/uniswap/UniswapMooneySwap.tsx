import { useSigner } from '@thirdweb-dev/react'
import { useState } from 'react'
import { TOKENS } from '../../lib/uniswap/uniswap-config'
import CurrencyField from './CurrencyField'
import LoadingSpinner from './LoadingSpinner'
import SwapSettings from './SwapSettings'

export default function UniswapMooneySwap({ account, MOONEYBalance }: any) {
  const signer = useSigner()
  const [slippageAmt, setSlippageAmt] = useState<any>(1)
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(10)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [currentTokenId, setCurrentTokenId] = useState<number>(5)
  const [currentETHBalance, setCurrentETHBalance] = useState<number>()

  const [inputAmt, setInputAmt] = useState<number>(0)
  const [outputAmt, setOutputAmt] = useState<number>(0)
  const [transaction, setTransaction] = useState<any>()
  const [loading, setLoading] = useState<boolean>(false)
  const [ratio, setRatio] = useState<number>()

  // function getSwapPrice(inputAmt: any) {
  //   setLoading(true)
  //   setInputAmt(inputAmt)
  //   getPrice(
  //     signer?.provider,
  //     inputAmt,
  //     slippageAmt,
  //     Math.floor(Date.now() / 1000 + deadlineMinutes * 60),
  //     account?.address,
  //     currentTokenId
  //   ).then((data: any) => {
  //     setTransaction(data[0])
  //     setOutputAmt(data[1])
  //     setRatio(data[2])
  //     setLoading(false)
  //   })
  // }

  return (
    <div className="w-full h-[350px] rounded-2xl p-4 backdropBlur">
      {/* <div className="w-full flex justify-end p-4 gap-[30%]">
        <CogIcon
          className="w-8 h-8 z-20"
          onClick={() => setShowModal(!showModal)}
        />
        {showModal && (
          <div className="absolute bg-[grey] p-6 rounded-2xl z-10">
            <SwapSettings
              slippageAmt={slippageAmt}
              setSlippageAmt={setSlippageAmt}
              deadlineMinutes={deadlineMinutes}
              setDeadlineMinutes={setDeadlineMinutes}
            />
          </div>
        )}
      </div>
      <div className="w-full flex flex-col gap-4">
        <CurrencyField
          field="input"
          currentToken={TOKENS[currentTokenId]}
          getSwapPrice={getSwapPrice}
          balance={currentTokenId === 1 ? currentETHBalance : MOONEYBalance}
          setCurrentTokenId={setCurrentTokenId}
        />
        <CurrencyField
          field="output"
          loading={loading}
          currentToken={TOKENS[0]}
          balance={MOONEYBalance?.formatted}
          value={Number(outputAmt).toFixed(3)}
        />
        {signer && account?.address ? (
          <button
            disabled={!account?.address || !signer}
            onClick={async () => {
              await swapForMooney(
                inputAmt,
                transaction,
                signer,
                currentTokenId,
                Math.floor(Date.now() / 1000 + deadlineMinutes * 60)
              )
            }}
          >
            Swap
          </button>
        ) : (
          <LoadingSpinner />
        )}
      </div> */}
    </div>
  )
}
