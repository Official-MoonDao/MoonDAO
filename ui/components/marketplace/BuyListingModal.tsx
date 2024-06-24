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
  ENTITY_ADDRESSES,
  MOONEY_ADDRESSES,
  USDC_ADDRESSES,
} from 'const/config'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import useCitizenEmail from '@/lib/citizen/useCitizenEmail'
import useEntityEmail from '@/lib/entity/useEntityEmail'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { Listing } from '@/components/marketplace/Listing'

type BuyListingModalProps = {
  selectedChain: any
  listing: Listing
  recipient: string
  setEnabled: Function
}

export default function BuyListingModal({
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

  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  const { data: entityNft } = useNFT(entityContract, listing.entityId)

  const entityEmail = useEntityEmail(entityNft)

  const [email, setEmail] = useState<string>()
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

    setIsLoading(true)
    let receipt
    try {
      if (listing.currency === 'ETH') {
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
        const accessToken = await getAccessToken()

        const etherscanUrl =
          process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
            ? 'https://arbiscan.io/tx/'
            : 'https://sepolia.etherscan.io/tx/'

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
            quantity: 1,
            tx: etherscanUrl + receipt.transactionHash,
            teamEmail: entityEmail,
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
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-marketplace-buy-modal-backdrop')
          setEnabled(false)
      }}
      id="entity-marketplace-buy-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={(e) => {
          e.preventDefault()
          if (!email || email.trim() === '' || !email.includes('@'))
            return toast.error('Please enter a valid email')
          buyListing()
        }}
      >
        <div className="w-full flex items-center justify-between">
          <div>
            <p>{'Buy a Listing'}</p>
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
          <p>{listing.title}</p>
          <p className="text-[75%]">{listing.description}</p>
          <p>{`${listing.price} ${listing.currency}`}</p>
        </div>
        <p className="opacity-60">
          Enter your email, confirm the transaction and wait to receive an email
          from the vendor.
        </p>
        <input
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          placeholder="Enter your email"
          value={email}
          onChange={({ target }) => setEmail(target.value)}
        />
        <button
          type="submit"
          className="mt-4 px-2 w-[100px] border-2 border-moon-orange text-moon-orange rounded-full"
          disabled={isLoading || !entityEmail}
        >
          {isLoading || !entityEmail ? 'Loading...' : 'Buy'}
        </button>
        {isLoading && (
          <p>Do not leave the page until the transaction is complete.</p>
        )}
      </form>
    </div>
  )
}
