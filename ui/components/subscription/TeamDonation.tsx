import { useWallets } from '@privy-io/react-auth'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import StandardButton from '../layout/StandardButton'
import Card from './Card'

type TeamDonationProps = {
  recipient: string | undefined
}

export default function TeamDonation({ recipient }: TeamDonationProps) {
  const account = useActiveAccount()
  const { selectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [donationAmount, setDonationAmount] = useState(0)

  async function donate() {
    //check network
    if (
      DEFAULT_CHAIN_V5.id !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      toast.error(`Please switch to ${selectedChain.name}.`)
      return wallets[selectedWallet]?.switchChain(DEFAULT_CHAIN_V5.id)
    }

    try {
      if (!account) return toast.error('Please connect your wallet.')
      if (donationAmount <= 0)
        return toast.error('Please enter a valid amount.')

      await account.sendTransaction({
        to: recipient,
        value: BigInt(+donationAmount * 10 ** 18),
        chainId: selectedChain.id,
      })
    } catch (err: any) {
      console.log(err.message)
      if (err.message.includes('insufficient funds')) {
        toast.error('Insufficient funds.')
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
