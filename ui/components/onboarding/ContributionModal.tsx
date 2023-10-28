import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
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
    <div
      className={`p-6 fixed top-20 left-[15vw] z-[100] w-full md:w-3/4 md:h-3/4 bg-background-dark ${
        !enabled && 'hidden'
      }`}
    >
      <div onClick={exitModal}>X</div>
      <h1>Payment Method:</h1>
      {/* Select Payment Method */}
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
    </div>
  )
}
