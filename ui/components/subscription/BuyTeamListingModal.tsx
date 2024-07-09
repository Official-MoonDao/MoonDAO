import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import {
  MediaRenderer,
  useAddress,
  useContract,
  useNFT,
  useSDK,
} from '@thirdweb-dev/react'
import {
  CITIZEN_ADDRESSES,
  DAI_ADDRESSES,
  TEAM_ADDRESSES,
  MOONEY_ADDRESSES,
  USDC_ADDRESSES,
} from 'const/config'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import useCitizenEmail from '@/lib/citizen/useCitizenEmail'
import useTeamEmail from '@/lib/team/useTeamEmail'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { TeamListing } from '@/components/subscription/TeamListing'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'

type BuyListingModalProps = {
  selectedChain: any
  listing: TeamListing
  recipient: string | undefined
  setEnabled: Function
}

export default function BuyTeamListingModal({
  selectedChain,
  listing,
  recipient,
  setEnabled,
}: BuyListingModalProps) {
  const sdk = useSDK()
  const address = useAddress()
  const { getAccessToken } = usePrivy()

  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )

  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug]
  )

  const { data: teamNft } = useNFT(teamContract, listing.teamId)

  const teamEmail = useTeamEmail(teamNft)

  const [email, setEmail] = useState<string>()
  const [shippingInfo, setShippingInfo] = useState({
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  })
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const { data: owns } = useHandleRead(citizenContract, 'getOwnedToken')
  const { data: citizenNft } = useNFT(citizenContract, owns)

  const citizenEmail = useCitizenEmail(citizenNft)

  const currencyAddresses: any = {
    MOONEY: MOONEY_ADDRESSES[selectedChain.slug],
    DAI: DAI_ADDRESSES[selectedChain.slug],
    USDC: USDC_ADDRESSES[selectedChain.slug],
  }

  const currencyDecimals: any = {
    MOONEY: 18,
    DAI: 18,
    USDC: 6,
  }

  const { contract: currencyContract }: any = useContract(
    currencyAddresses[listing.currency]
  )

  useEffect(() => {
    if (citizenEmail) {
      setEmail(citizenEmail)
    }
  }, [citizenEmail])

  async function buyListing() {
    const price = Number(listing.price)
    console.log(recipient)
    setIsLoading(true)
    let receipt
    try {
      if (+listing.price <= 0) {
        receipt = true
      } else if (listing.currency === 'ETH') {
        // buy with eth
        const signer = sdk?.getSigner()
        const tx = await signer?.sendTransaction({
          to: recipient,
          value: String(price * 10 ** 18),
        })
        receipt = await tx?.wait()
      } else {
        // buy with erc20
        const tx = await currencyContract?.call('transfer', [
          recipient,
          String(price * 10 ** currencyDecimals[listing.currency]),
        ])
        receipt = tx.receipt
      }

      if (receipt) {
        console.log(receipt)
        const accessToken = await getAccessToken()

        const etherscanUrl =
          process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
            ? 'https://arbiscan.io/tx/'
            : 'https://sepolia.etherscan.io/tx/'

        const transactionLink =
          +listing.price <= 0 ? 'none' : etherscanUrl + receipt.transactionHash

        const shipping = Object.values(shippingInfo).join(', ')

        //send email to entity w/ purchase details
        const res = await fetch('/api/nodemailer/marketplace-purchase', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            address,
            email,
            item: listing.title,
            value: listing.price + ' ' + listing.currency,
            quantity: 1,
            tx: transactionLink,
            shipping,
            teamEmail: teamEmail,
          }),
        })

        toast.success(
          "Successfull purchase! You'll receive an email shortly.",
          {
            duration: 10000,
          }
        )
      }

      setEnabled(false)
    } catch (err: any) {
      console.log(err)
      if (
        err.message.startsWith('insufficient funds') ||
        err?.reason?.includes('insufficient-balance') ||
        err?.reason?.includes('transfer amount exceeds balance')
      ) {
        toast.error('Insufficient funds')
      }
    }
    setIsLoading(false)
  }

  return (
    <Modal id="team-marketplace-buy-modal-backdrop" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={(e) => {
          e.preventDefault()
          if (!email || email.trim() === '' || !email.includes('@'))
            return toast.error('Please enter a valid email')
          if (listing.shipping === 'true') {
            if (
              shippingInfo.streetAddress.trim() === '' ||
              shippingInfo.city.trim() === '' ||
              shippingInfo.state.trim() === '' ||
              shippingInfo.postalCode.trim() === '' ||
              shippingInfo.country.trim() === ''
            )
              return toast.error('Please fill out all fields')
          }
          buyListing()
        }}
      >
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes">{'Buy a Listing'}</h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div>
          <MediaRenderer src={listing.image} width="200px" height="200px" />
          <div className="mt-4">
            <p className="font-GoodTimes">{listing.title}</p>
            <p className="text-[75%]">{listing.description}</p>
            <p className="font-bold">{`${listing.price} ${listing.currency}`}</p>
          </div>
        </div>
        <p className="opacity-60">
          Enter your information, confirm the transaction and wait to receive an
          email from the vendor.
        </p>
        <input
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          placeholder="Enter your email"
          value={email}
          onChange={({ target }) => setEmail(target.value)}
        />
        {listing.shipping === 'true' && (
          <div className="w-full flex flex-col gap-2">
            <input
              className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
              placeholder="Street Address"
              value={shippingInfo.streetAddress}
              onChange={({ target }) =>
                setShippingInfo({
                  ...shippingInfo,
                  streetAddress: target.value,
                })
              }
            />
            <div className="w-full flex gap-2">
              <input
                className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                placeholder="City"
                value={shippingInfo.city}
                onChange={({ target }) =>
                  setShippingInfo({ ...shippingInfo, city: target.value })
                }
              />
              <input
                className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                placeholder="State"
                value={shippingInfo.state}
                onChange={({ target }) =>
                  setShippingInfo({ ...shippingInfo, state: target.value })
                }
              />
            </div>
            <div className="w-full flex gap-2">
              <input
                className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                placeholder="Postal Code"
                value={shippingInfo.postalCode}
                onChange={({ target }) =>
                  setShippingInfo({ ...shippingInfo, postalCode: target.value })
                }
              />
              <input
                className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                placeholder="Country"
                value={shippingInfo.country}
                onChange={({ target }) =>
                  setShippingInfo({ ...shippingInfo, country: target.value })
                }
              />
            </div>
          </div>
        )}
        <StandardButton
          type="submit"
          className="mt-4 w-full gradient-2 rounded-[5vmax]"
          disabled={isLoading || !teamEmail || !recipient}
        >
          {isLoading || !teamEmail || !recipient ? 'Loading...' : 'Buy'}
        </StandardButton>
        {isLoading && (
          <p>Do not leave the page until the transaction is complete.</p>
        )}
      </form>
    </Modal>
  )
}
