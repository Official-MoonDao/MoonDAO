import { getAccessToken } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import ERC20ABI from 'const/abis/ERC20.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  DAI_ADDRESSES,
  TEAM_ADDRESSES,
  MOONEY_ADDRESSES,
  USDC_ADDRESSES,
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
} from 'const/config'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useCitizenEmail from '@/lib/citizen/useCitizenEmail'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { TeamListing } from '@/components/subscription/TeamListing'
import IPFSRenderer from '../layout/IPFSRenderer'
import Input from '../layout/Input'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type BuyListingModalProps = {
  selectedChain: any
  listing: TeamListing
  recipient: string | undefined | null
  setEnabled: (enabled: boolean) => void
}

export default function BuyTeamListingModal({
  selectedChain,
  listing,
  recipient,
  setEnabled,
}: BuyListingModalProps) {
  const chainSlug = getChainSlug(selectedChain)
  const { citizen } = useContext(CitizenContext)
  const account = useActiveAccount()

  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
    chain: selectedChain,
  })

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: selectedChain,
  })

  const [teamNFT, setTeamNFT] = useState<any>()
  const [citizenNFT, setCitizenNFT] = useState<any>()

  const [email, setEmail] = useState<string>()
  const [shippingInfo, setShippingInfo] = useState({
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  })
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const citizenEmail = useCitizenEmail(citizen)

  const currencyAddresses: any = {
    MOONEY: MOONEY_ADDRESSES[chainSlug],
    DAI: DAI_ADDRESSES[chainSlug],
    USDC: USDC_ADDRESSES[chainSlug],
  }

  const currencyDecimals: any = {
    ETH: 18,
    MOONEY: 18,
    DAI: 18,
    USDC: 6,
  }

  const currencyContract = useContract({
    address: currencyAddresses[listing.currency],
    abi: ERC20ABI as any,
    chain: selectedChain,
  })

  useEffect(() => {
    async function getTeamNFT() {
      const nft = await getNFT({
        contract: teamContract,
        tokenId: BigInt(listing.teamId),
      })
      setTeamNFT(nft)
    }
    async function getCitizenNFT() {
      const owns: any = await readContract({
        contract: citizenContract,
        method: 'getOwnedToken' as string,
        params: [account?.address],
      })

      const nft = await getNFT({
        contract: citizenContract,
        tokenId: BigInt(owns),
      })
      setCitizenNFT(nft)
    }
    if (teamContract) getTeamNFT()
    if (account && citizenContract) getCitizenNFT()
  }, [account, teamContract, citizenContract, listing.teamId])

  useEffect(() => {
    setEmail(citizenEmail)
  }, [citizenEmail])

  async function buyListing() {
    if (!account) return

    let price
    if (citizen) {
      price = +listing.price
    } else {
      price = +listing.price + +listing.price * 0.1 // 10% upcharge for non-citizens
    }

    setIsLoading(true)
    let transactionHash

    try {
      // Execute the transaction
      if (+listing.price <= 0) {
        transactionHash = 'none'
      } else if (listing.currency === 'ETH') {
        // buy with eth
        const tx = await account?.sendTransaction({
          to: recipient,
          value: BigInt(price * 10 ** 18),
          chainId: selectedChain.id,
        })
        transactionHash = tx?.transactionHash
      } else {
        // buy with erc20
        const transaction = prepareContractCall({
          contract: currencyContract,
          method: 'transfer' as string,
          params: [recipient, String(price * 10 ** currencyDecimals[listing.currency])],
        })
        const receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        transactionHash = receipt?.transactionHash
      }

      if (transactionHash) {
        const etherscanUrl =
          process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
            ? 'https://arbiscan.io/tx/'
            : 'https://sepolia.etherscan.io/tx/'

        const transactionLink = +listing.price <= 0 ? 'none' : etherscanUrl + transactionHash

        const shipping = Object.values(shippingInfo).join(', ')

        const accessToken = await getAccessToken()

        // Send email request with transaction verification
        const res = await fetch('/api/marketplace/marketplace-purchase', {
          method: 'POST',
          body: JSON.stringify({
            address: account?.address,
            email,
            item: listing.title,
            value: price,
            originalValue: +listing.price,
            currency: listing.currency,
            decimals: currencyDecimals[listing.currency],
            quantity: 1,
            txLink: transactionLink,
            txHash: transactionHash,
            recipient,
            isCitizen: citizen ? true : false,
            shipping,
            teamLink: `${DEPLOYED_ORIGIN}/team/${generatePrettyLink(teamNFT.metadata.name)}`,
            accessToken,
          }),
        })

        const { success, message: responseMessage } = await res.json()

        if (success) {
          toast.success("Successful purchase! You'll receive an email shortly.", {
            duration: 10000,
          })
        } else {
          console.log(responseMessage)
          toast.error('Something went wrong, please contact support.', {
            duration: 10000,
          })
        }
      }

      setEnabled(false)
    } catch (err: any) {
      console.log(err)
      if (err && !err.message.startsWith('user rejected transaction')) {
        toast.error(err.message)
      }
    }
    setIsLoading(false)
  }

  return (
    <Modal
      id="team-marketplace-buy-modal-backdrop"
      setEnabled={setEnabled}
      title="Buy a Listing"
      size="lg"
    >
      <form
        className="w-full flex flex-col gap-2 items-start justify-start"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <div>
          {listing.image && (
            <div
              id="image-container"
              className="rounded-[20px] overflow-hidden my flex flex-wrap w-full"
            >
              <IPFSRenderer src={listing.image} width={500} height={500} alt="Listing Image" />
            </div>
          )}

          <div className="mt-4">
            <p>{`# ${listing.id}`}</p>
            <p className="font-GoodTimes">{listing.title}</p>
            <p className="text-[75%]">{listing.description}</p>
            <p id="listing-price" className="font-bold">{`${
              citizen
                ? truncateTokenValue(listing.price, listing.currency)
                : truncateTokenValue(+listing.price * 1.1, listing.currency)
            } ${listing.currency}`}</p>
          </div>
        </div>
        <p className="opacity-60">
          Enter your information, confirm the transaction and wait to receive an email from the
          vendor.
        </p>
        <Input
          type="text"
          variant="dark"
          className="text-white"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          formatNumbers={false}
        />
        {listing.shipping === 'true' && (
          <div className="w-full flex flex-col gap-2">
            <Input
              type="text"
              variant="dark"
              className="text-white"
              placeholder="Street Address"
              value={shippingInfo.streetAddress}
              onChange={(e) =>
                setShippingInfo({
                  ...shippingInfo,
                  streetAddress: e.target.value,
                })
              }
              formatNumbers={false}
            />
            <div className="w-full flex gap-2">
              <Input
                type="text"
                variant="dark"
                className="text-white"
                placeholder="City"
                value={shippingInfo.city}
                onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                formatNumbers={false}
              />
              <Input
                type="text"
                variant="dark"
                className="text-white"
                placeholder="State"
                value={shippingInfo.state}
                onChange={(e) => setShippingInfo({ ...shippingInfo, state: e.target.value })}
                formatNumbers={false}
              />
            </div>
            <div className="w-full flex gap-2">
              <Input
                type="text"
                variant="dark"
                className="text-white"
                placeholder="Postal Code"
                value={shippingInfo.postalCode}
                onChange={(e) =>
                  setShippingInfo({
                    ...shippingInfo,
                    postalCode: e.target.value,
                  })
                }
                formatNumbers={false}
              />
              <Input
                type="text"
                variant="dark"
                className="text-white"
                placeholder="Country"
                value={shippingInfo.country}
                onChange={(e) => setShippingInfo({ ...shippingInfo, country: e.target.value })}
                formatNumbers={false}
              />
            </div>
          </div>
        )}
        <PrivyWeb3Button
          v5
          requiredChain={DEFAULT_CHAIN_V5}
          label="Buy"
          action={async () => {
            if (!email || email.trim() === '' || !email.includes('@'))
              return toast.error('Please enter a valid email.')
            if (listing.shipping === 'true') {
              if (
                shippingInfo.streetAddress.trim() === '' ||
                shippingInfo.city.trim() === '' ||
                shippingInfo.state.trim() === '' ||
                shippingInfo.postalCode.trim() === '' ||
                shippingInfo.country.trim() === ''
              )
                return toast.error('Please fill out all fields.')
            }
            await buyListing()
          }}
          className="mt-4 w-full gradient-2 rounded-[5vmax]"
          isDisabled={isLoading || !recipient}
        />
        {isLoading && <p>Do not leave the page until the transaction is complete.</p>}
      </form>
    </Modal>
  )
}
