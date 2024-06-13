import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { BigNumber } from 'ethers'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import Button from './Button'
import Card from './Card'

type EntityDonationProps = {
  multisigAddress: string
}

export default function EntityDonation({
  multisigAddress,
}: EntityDonationProps) {
  const address = useAddress()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const [donationAmount, setDonationAmount] = useState(0)

  const nativeBalance = useNativeBalance()

  async function donate() {
    try {
      if (!address) return toast.error('Please connect your wallet')
      if (donationAmount <= 0) return toast.error('Please enter a valid amount')
      console.log(nativeBalance)
      const provider = await wallets[selectedWallet].getEthersProvider()
      const signer = provider.getSigner()

      await signer.sendTransaction({
        to: multisigAddress,
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
      <p className="text-2xl">Contribute</p>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex gap-4 items-center">
          <input
            className="w-[100px] bg-[#0f152f] px-2 h-full"
            type="number"
            onChange={({ target }: any) => setDonationAmount(target.value)}
            value={donationAmount}
            step={0.001}
          />
          <p>ETH</p>
        </div>
        <Button onClick={donate}>Donate</Button>
      </div>
    </Card>
  )
}
