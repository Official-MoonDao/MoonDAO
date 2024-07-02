import { useAddress, useSDK } from '@thirdweb-dev/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Frame from '../layout/Frame'
import StandardButton from '../layout/StandardButton'
import Button from './Button'
import Card from './Card'

type TeamDonationProps = {
  splitAddress: string | undefined
}

export default function TeamDonation({ splitAddress }: TeamDonationProps) {
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
      <div className="flex flex-col lg:flex-row gap-4 justify-center">
        <Frame noPadding marginBottom="0px">
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
            <div id="" className="gradient-2">
              <StandardButton type="submit">Donate</StandardButton>
            </div>
          </form>
        </Frame>
      </div>
    </Card>
  )
}
