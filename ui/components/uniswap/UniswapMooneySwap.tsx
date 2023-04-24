import { CogIcon } from '@heroicons/react/outline'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { useProvider, useSigner } from 'wagmi'
import { useBalance } from 'wagmi'
import { getPrice, swapForMooney } from '../../lib/uniswap-alpha-router'
import { TOKENS } from '../../lib/uniswap-config'
import CurrencyField from './CurrencyField'
import LoadingSpinner from './LoadingSpinner'
import SwapSettings from './SwapSettings'

export default function UniswapMooneySwap({ account, MOONEYBalance }: any) {
  const provider = useProvider({ chainId: 1 })
  const { data: signer } = useSigner()
  const [slippageAmt, setSlippageAmt] = useState<any>(1)
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(10)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [currentTokenId, setCurrentTokenId] = useState<number>(5)
  const [currentETHBalance, setCurrentETHBalance] = useState<number>()
  const { data: currentTokenBalance, isLoading: currentTokenBalanceLoading } =
    useBalance({
      addressOrName: account?.address,
      token: TOKENS[currentTokenId].address,
      watch: true,
    })

  const [inputAmt, setInputAmt] = useState<number>(0)
  const [outputAmt, setOutputAmt] = useState<number>(0)
  const [transaction, setTransaction] = useState<any>()
  const [loading, setLoading] = useState<boolean>(false)
  const [ratio, setRatio] = useState<number>()

  function getSwapPrice(inputAmt: any) {
    setLoading(true)
    setInputAmt(inputAmt)
    getPrice(
      provider,
      inputAmt,
      slippageAmt,
      Math.floor(Date.now() / 1000 + deadlineMinutes * 60),
      account?.address,
      currentTokenId
    ).then((data) => {
      setTransaction(data[0])
      setOutputAmt(data[1])
      setRatio(data[2])
      setLoading(false)
    })
  }

  return (
    <div className="w-full h-[350px] rounded-2xl p-4 backdropBlur">
      <div className="w-full flex justify-end p-4 gap-[30%]">
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
          balance={
            currentTokenId === 1
              ? currentETHBalance
              : currentTokenBalance?.formatted
          }
          setCurrentTokenId={setCurrentTokenId}
        />
        <CurrencyField
          field="output"
          loading={loading}
          currentToken={TOKENS[0]}
          balance={MOONEYBalance?.formatted}
          value={Number(outputAmt).toFixed(3)}
        />
        {provider && account?.address ? (
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
      </div>
    </div>
  )
}
