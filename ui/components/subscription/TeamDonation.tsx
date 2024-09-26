import { useWallets } from '@privy-io/react-auth'
import { useAddress, useSDK } from '@thirdweb-dev/react'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContext from '@/lib/thirdweb/chain-context'
import StandardButton from '../layout/StandardButton'
import Card from './Card'

type TeamDonationProps = {
  splitAddress: string | undefined
}

export default function TeamDonation({ splitAddress }: TeamDonationProps) {
  const { selectedChain } = useContext(ChainContext)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const address = useAddress()
  const sdk = useSDK()
  const [donationAmount, setDonationAmount] = useState(0)

  async function donate() {
    //check network
    if (
      selectedChain.chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      toast.error(`Please switch to ${selectedChain.name}`)
      return wallets[selectedWallet]?.switchChain(selectedChain.chainId)
    }

    try {
      const signer = sdk?.getSigner()

      if (!address || !signer) return toast.error('Please connect your wallet')
      if (donationAmount <= 0) return toast.error('Please enter a valid amount')

      await signer.sendTransaction({
        to: splitAddress,
        value: String(+donationAmount * 10 ** 18),
      })
    } catch (err: any) {
      console.log(err.message)
      if (err.message.includes('insufficient funds')) {
        toast.error('Insufficient funds')
      }
    }
  }

  return (
    <Card className="flex flex-col lg:flex-row justify-between gap-4">
      <div className="flex flex-col lg:flex-row gap-4 justify-start">
        <div>
          <form
            className="rounded-[20px] rounded-tl-[10px] md:rounded-tl-[20px] md:rounded-bl-[10px] overflow-hidden flex bg-dark-cool gap-4 items-center justify-between"
            onSubmit={(e) => {
              e.preventDefault()
              donate()
            }}
          >
            <input
              className="w-full min-w-[40px] max-w-[100px] bg-dark-cool pl-5 h-full focus:outline-none"
              type="number"
              onChange={({ target }: any) => setDonationAmount(target.value)}
              value={donationAmount}
              step={0.001}
            />
            <p>ETH</p>
            <div id="" className="gradient-2">
              <StandardButton type="submit">Send</StandardButton>
            </div>
          </form>
        </div>
      </div>
    </Card>
  )
}
