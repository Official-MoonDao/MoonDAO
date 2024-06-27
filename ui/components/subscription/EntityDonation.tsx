import { useWallets } from '@privy-io/react-auth'
import { useAddress, useSDK } from '@thirdweb-dev/react'
import { BigNumber } from 'ethers'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import Button from './Button'
import Card from './Card'
import Frame from '../layout/Frame'

type EntityDonationProps = {
  splitAddress: string | undefined
}

export default function EntityDonation({ splitAddress }: EntityDonationProps) {
  const address = useAddress()
  const sdk = useSDK()
  const [donationAmount, setDonationAmount] = useState(0)

  async function donate() {
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
      <p className="text-2xl">Contribute</p>
        <div className="flex flex-col lg:flex-row gap-4">
        <Frame noPadding>
          <form
            className="flex bg-dark-cool gap-4 items-center justify-between"
            onSubmit={(e) => {
              e.preventDefault()
              donate()
            }}
          >
            <input
              className="w-[100px] bg-dark-cool pl-5 h-full"
              type="number"
              onChange={({ target }: any) => setDonationAmount(target.value)}
              value={donationAmount}
              step={0.001}
            />
            <p>ETH</p>
            <div id=""
              className="gradient-2"
              >
              <Button type="submit">Donate</Button>
            </div>
          </form>
          </Frame>
        </div>  
    </Card>
  )
}