//New
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import { useContext, useEffect, useState, Fragment } from 'react'
import React from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'
import { useVMOONEYCreateLock } from '../../lib/tokens/ve-token'
import {
  V3_SWAP_ROUTER_ADDRESS,
  useSwapRouter,
} from '../../lib/uniswap/hooks/useSwapRouter'
import { VMOONEY_ADDRESSES, MOONEY_ADDRESSES } from '../../const/config'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type ContributionModalProps = {
  selectedLevel: number
  setSelectedLevel: Function
}

export function ContributionModal({
  selectedLevel,
  setSelectedLevel,
}: ContributionModalProps) {
  const address = useAddress()
  const [enabled, setEnabled] = useState<boolean>(false)
  const [paymentMethod, setPaymentMethod] = useState('ethereum')

  //Privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  //MoonPay
  const fund = useMoonPay()

  //Alchemy
  // const lightAccountProvider = useLightAccount(wallets)

  //Uniswap
  const [swapRoute, setSwapRoute] = useState<any>()
  const { generateRoute, executeRoute } = useSwapRouter(selectedLevel)

  //Thirdweb
  const { contract: mooneyContract }: any = useContract(
    MOONEY_ADDRESSES['ethereum']
  )
  const { contract: vMooneyContract }: any = useContract(
    VMOONEY_ADDRESSES['ethereum']
  )

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address,
    VMOONEY_ADDRESSES['ethereum']
  )

  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    ethers.utils.parseEther(swapRoute?.route[0]?.rawQuote.toString() || '0'),
    BigNumber.from(0),
    VMOONEY_ADDRESSES['ethereum']
  )

  const { mutateAsync: createLock } = useVMOONEYCreateLock(
    vMooneyContract,
    ethers.utils.parseEther(selectedLevel.toString()),
    Date.now() + 1000 * 60 * 60 * 24 * 365 * 2 //2 years
  )

  function exitModal() {
    setEnabled(false)
    setSelectedLevel(0)
  }

  useEffect(() => {
    if (selectedLevel > 0) setEnabled(true)
    generateRoute().then((swapRoute: any) => setSwapRoute(swapRoute))
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
                    const selectedWalletType =
                      wallets[selectedWallet].walletClientType
                    const provider: any = await wallets[
                      selectedWallet
                    ].getEthersProvider()

                    const nativeBalance = await provider.getBalance(
                      wallets[selectedWallet].address
                    )

                    const formattedNativeBalance =
                      ethers.utils.formatEther(nativeBalance)

                    if (
                      +formattedNativeBalance < selectedLevel ||
                      paymentMethod === 'card'
                    ) {
                      paymentMethod !== 'card' &&
                        toast(
                          'This wallet does not have enough matic to purchase the tier, please fund your wallet with moonpay or an alternative method.'
                        )
                      setTimeout(
                        async () => {
                          await fund(selectedLevel - +formattedNativeBalance)
                        },
                        paymentMethod === 'card' ? 0 : 3000
                      )
                    }

                    //if the wallet is a privy embedded wallet, batch the transactions
                    //if the wallet is an external wallet (metamask, coinbase, etc), execute the transactions one by one

                    if (selectedWalletType === 'privy') {
                      //swap, approve, lock
                      const approveMooneyCallData =
                        mooneyContract.interface.encodeFunctionData('approve', [
                          VMOONEY_ADDRESSES['ethereum'],
                          swapRoute.route[0].rawQuote,
                        ])

                      const createLockCallData =
                        vMooneyContract.interface.encodeFunctionData(
                          'createLock',
                          [
                            ethers.utils.parseEther(selectedLevel.toString()),
                            Date.now() + 1000 * 60 * 60 * 24 * 365 * 2,
                          ]
                        )

                      const batchTx = await provider.sendTransactions([
                        {
                          target: V3_SWAP_ROUTER_ADDRESS,
                          data: swapRoute?.methodParameters?.calldata,
                          value: swapRoute?.methodParameters?.value,
                        },
                        {
                          target: MOONEY_ADDRESSES['polygon'],
                          data: approveMooneyCallData,
                        },
                        {
                          target: VMOONEY_ADDRESSES['polygon'],
                          data: createLockCallData,
                        },
                      ]).hash
                      console.log(batchTx)
                    } else {
                      toast('Swap matic/eth for mooney')
                      //swap eth for mooney
                      try {
                        const swapTx = await executeRoute(swapRoute)
                        if (!swapTx)
                          return toast.error(
                            'Onboarding canceled, user rejected swap'
                          )
                        swapTx &&
                          toast.success('Successfully swapped ETH for Mooney')

                        //check mooney approval & approve swapped mooney if needed
                        const swappedMooney =
                          +swapRoute?.route[0].rawQuote.toString()
                        if (tokenAllowance < swappedMooney) {
                          const approvalTx = await approveToken()
                          if (!approvalTx)
                            return toast.error(
                              'Onboarding canceled, user rejected approval'
                            )
                          approvalTx?.receipt &&
                            toast.success(
                              'Successfully approved MOONEY for lock!'
                            )
                        }

                        //create lock for mooney
                        const lockTx = await createLock?.()
                        if (!lockTx)
                          return toast.error(
                            'Onboarding canceled, user rejected lock'
                          )
                        lockTx?.receipt &&
                          toast.success(
                            'Successfully locked $MOONEY for Voting Power!'
                          )
                      } catch (err: any) {
                        console.log(
                          'There was an issue onboarding',
                          err.message
                        )
                        toast.error('There was an issue onboarding')
                      }
                    }
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
