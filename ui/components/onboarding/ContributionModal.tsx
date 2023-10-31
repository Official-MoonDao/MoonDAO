//New
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useContext, useEffect, useState, Fragment } from 'react'
import React from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type ContributionModalProps = {
  selectedLevel: number
  setSelectedLevel: Function
}

export function ContributionModal({
  selectedLevel,
  setSelectedLevel,
}: ContributionModalProps) {
  const [enabled, setEnabled] = useState<boolean>(false)
  const [paymentMethod, setPaymentMethod] = useState('ethereum')
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const fund = useMoonPay()

  const { generateRoute, executeRoute } = useSwapRouter(selectedLevel)

  function exitModal() {
    setEnabled(false)
    setSelectedLevel(0)
  }

  useEffect(() => {
    if (selectedLevel > 0) setEnabled(true)
  }, [selectedLevel])

  return (
    <Transition.Root show={enabled} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setEnabled}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-700 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full  justify-center p-4 text-center items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="font-RobotoMono relative transform overflow-hidden rounded-lg bg-[#0A0E22] px-2 pb-4 pt-3 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                {/*Title and explanation*/}
                <div>
                  <div className="mt-3 text-center lg:text-left sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="dark:text-white font-GoodTimes text-xl"
                    >
                      Payment Method
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm lg:text-base opacity-60">
                        Choose your preferred payment method to get started
                      </p>
                    </div>
                  </div>
                </div>

                {/*Payment methods and explanation*/}

                {/* */}
                <div
                  className={`py-2 ${
                    paymentMethod === 'eth' && 'bg-white text-black'
                  }`}
                  onClick={() => setPaymentMethod('eth')}
                >
                  Ethereum
                </div>

                <div
                  className={`py-2 ${
                    paymentMethod === 'card' && 'bg-white text-black'
                  }`}
                  onClick={() => setPaymentMethod('card')}
                >
                  Credit Card
                </div>


                {/*Web3 purchase button */}
                <PrivyWeb3Button
          label="Purchase"
          action={async () => {
            const provider = await wallets[selectedWallet].getEthersProvider()
            const nativeBalance = await provider.getBalance(
              wallets[selectedWallet].address
            )

            const formattedNativeBalance =
              ethers.utils.formatEther(nativeBalance)

            // if (
            //   +formattedNativeBalance < selectedLevel ||
            //   paymentMethod === 'card'
            // ) {
            //   setTimeout(async () => {
            //     await fund(selectedLevel - +formattedNativeBalance)
            //   }, 3000)
            // }

            //buy mooney on L2 using uniswap
            const route = await generateRoute()

            const tx = await executeRoute(route)
            //approve mooney for lock
            //lock mooney
          }}
          isDisabled={selectedLevel === 0}
        />


                {/*Close button */}
                <button
                  type="button"
                  className="absolute right-1 top-1 bg-indigo-600 px-1 py-1 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  onClick={() => setEnabled(false)}
                >
                  x
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default ContributionModal

/*

<div onClick={exitModal}>X</div>
      <h1>Payment Method:</h1>
      //Select Payment Method
      <div className="flex flex-col">
        
        
        <div
          className={`py-2 ${paymentMethod === 'eth' && 'bg-white text-black'}`}
          onClick={() => setPaymentMethod('eth')}
        >
          Ethereum
        </div>
        
        
        
        <div
          className={`py-2 ${
            paymentMethod === 'card' && 'bg-white text-black'
          }`}
          onClick={() => setPaymentMethod('card')}
        >
          Credit Card
        </div>

        <PrivyWeb3Button
          label="Purchase"
          action={async () => {
            const provider = await wallets[selectedWallet].getEthersProvider()
            const nativeBalance = await provider.getBalance(
              wallets[selectedWallet].address
            )

            const formattedNativeBalance =
              ethers.utils.formatEther(nativeBalance)

            // if (
            //   +formattedNativeBalance < selectedLevel ||
            //   paymentMethod === 'card'
            // ) {
            //   setTimeout(async () => {
            //     await fund(selectedLevel - +formattedNativeBalance)
            //   }, 3000)
            // }

            //buy mooney on L2 using uniswap
            const route = await generateRoute()

            const tx = await executeRoute(route)
            //approve mooney for lock
            //lock mooney
          }}
          isDisabled={selectedLevel === 0}
        />

      </div>
      
      
    */
