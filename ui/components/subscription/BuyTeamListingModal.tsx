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
import { prepareContractCall, readContract, sendAndConfirmTransaction, toUnits } from 'thirdweb'
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
        includeOwner: true,
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

  // The recipient prop comes from the parent's team-owner lookup, which can be
  // missing when the RPC is rate-limited. Fall back to the owner fetched here so
  // the Buy button isn't permanently disabled.
  const resolvedRecipient = recipient || teamNFT?.owner

  async function buyListing() {
    if (!account || !resolvedRecipient) return

    const numericPrice = parseFloat(listing.price.replace(/,/g, ''))
    let price
    if (citizen) {
      price = numericPrice
    } else {
      price = numericPrice * 1.1 // 10% upcharge for non-citizens
    }

    setIsLoading(true)
    let transactionHash

    try {
      // Execute the transaction
      if (numericPrice <= 0) {
        transactionHash = 'none'
      } else if (listing.currency === 'ETH') {
        // buy with eth
        const tx = await account?.sendTransaction({
          to: resolvedRecipient,
          value: toUnits(String(price), currencyDecimals.ETH),
          chainId: selectedChain.id,
        })
        transactionHash = tx?.transactionHash
      } else {
        // buy with erc20
        const transaction = prepareContractCall({
          contract: currencyContract,
          method: 'transfer' as string,
          params: [
            resolvedRecipient,
            toUnits(String(price), currencyDecimals[listing.currency]),
          ],
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

        const transactionLink = numericPrice <= 0 ? 'none' : etherscanUrl + transactionHash

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
            originalValue: numericPrice,
            currency: listing.currency,
            decimals: currencyDecimals[listing.currency],
            quantity: 1,
            txLink: transactionLink,
            txHash: transactionHash,
            recipient: resolvedRecipient,
            isCitizen: citizen ? true : false,
            shipping,
            teamLink: `${DEPLOYED_ORIGIN}/team/${generatePrettyLink(teamNFT.metadata.name)}`,
            accessToken,
          }),
        })

        const { success, message: responseMessage } = await res.json()

        if (success) {
          toast.success('Purchase complete! Confirmation email on the way.', {
            duration: 10000,
          })
        } else {
          console.log(responseMessage)
          toast.error('Purchase failed. Please contact support.', {
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
        className="w-full flex flex-col gap-5 items-start justify-start"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {listing.image && (
            <div id="image-container" className="relative w-full h-56 sm:h-64">
              <IPFSRenderer
                src={listing.image}
                width={600}
                height={600}
                alt="Listing Image"
                className="object-cover"
                fillContainer
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                {`#${listing.id}`}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2 p-4">
            <h3 className="font-GoodTimes text-lg leading-tight text-white">{listing.title}</h3>
            <p className="text-sm leading-relaxed text-white/60">{listing.description}</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p id="listing-price" className="font-GoodTimes text-xl text-white">{`${
                citizen
                  ? truncateTokenValue(listing.price, listing.currency)
                  : truncateTokenValue(parseFloat(listing.price.replace(/,/g, '')) * 1.1, listing.currency)
              } ${listing.currency}`}</p>
              {!citizen && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
                  Includes 10% non-citizen fee
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm opacity-60">
          Enter your information, confirm the transaction and wait to receive an email from the
          vendor.
        </p>
        <Input
          type="text"
          variant="dark"
          label="Email"
          className="text-white"
          maxWidth="max-w-full"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          formatNumbers={false}
        />
        {listing.shipping === 'true' && (
          <div className="w-full flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="font-GoodTimes text-sm text-white">Shipping Address</p>
            <Input
              type="text"
              variant="dark"
              className="text-white"
              maxWidth="max-w-full"
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
            <div className="w-full flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                variant="dark"
                className="text-white"
                maxWidth="max-w-full"
                placeholder="City"
                value={shippingInfo.city}
                onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                formatNumbers={false}
              />
              <Input
                type="text"
                variant="dark"
                className="text-white"
                maxWidth="max-w-full"
                placeholder="State"
                value={shippingInfo.state}
                onChange={(e) => setShippingInfo({ ...shippingInfo, state: e.target.value })}
                formatNumbers={false}
              />
            </div>
            <div className="w-full flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                variant="dark"
                className="text-white"
                maxWidth="max-w-full"
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
                maxWidth="max-w-full"
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
          label={
            isLoading
              ? 'Processing...'
              : resolvedRecipient
              ? 'Buy'
              : 'Loading vendor...'
          }
          action={async () => {
            if (!resolvedRecipient)
              return toast.error(
                'Still loading the vendor details. Please try again in a moment.'
              )
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
          className="w-full gradient-2 rounded-[5vmax]"
          isDisabled={isLoading || !resolvedRecipient}
        />
        {!resolvedRecipient && !isLoading && (
          <p className="w-full text-center text-sm opacity-60">Loading vendor details...</p>
        )}
        {isLoading && (
          <p className="w-full text-center text-sm opacity-60">
            Do not leave the page until the transaction is complete.
          </p>
        )}
      </form>
    </Modal>
  )
}
