import { XMarkIcon } from '@heroicons/react/24/outline'
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
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useCitizenEmail from '@/lib/citizen/useCitizenEmail'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import useTeamEmail from '@/lib/team/useTeamEmail'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { TeamListing } from '@/components/subscription/TeamListing'
import IPFSRenderer from '../layout/IPFSRenderer'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type BuyListingModalProps = {
  selectedChain: any
  listing: TeamListing
  recipient: string | undefined | null
  setEnabled: Function
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

  const teamEmail = useTeamEmail(teamNFT)

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
  }, [account, teamContract, citizenContract])

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
          params: [
            recipient,
            String(price * 10 ** currencyDecimals[listing.currency]),
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

        const transactionLink =
          +listing.price <= 0 ? 'none' : etherscanUrl + transactionHash

        const shipping = Object.values(shippingInfo).join(', ')

        const accessToken = await getAccessToken()

        //send email to entity w/ purchase details
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
            teamEmail,
            teamAddress: teamNFT.owner,
            teamLink: `${DEPLOYED_ORIGIN}/team/${generatePrettyLink(
              teamNFT.metadata.name
            )}`,
            accessToken: accessToken,
          }),
        })

        const { success, message } = await res.json()

        if (success) {
          toast.success(
            "Successfull purchase! You'll receive an email shortly.",
            {
              duration: 10000,
            }
          )
        } else {
          console.log(message)
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

  //There is a bug where setEnabled can't be called from a button in the main component
  function Close() {
    const [close, setClose] = useState(false)

    useEffect(() => {
      if (close) setEnabled(false)
    }, [close])

    return (
      <button
        type="button"
        className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
        onClick={() => setClose(true)}
      >
        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
      </button>
    )
  }

  return (
    <Modal id="team-marketplace-buy-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full rounded-[2vmax] flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5  bg-dark-cool h-screen md:h-auto">
        <form
          className="w-full flex flex-col gap-2 items-start justify-start"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <div className="w-full flex items-center justify-between">
            <div>
              <h2 className="font-GoodTimes">{'Buy a Listing'}</h2>
            </div>
            <Close />
          </div>
          <div>
            {listing.image && (
              <div
                id="image-container"
                className="rounded-[20px] overflow-hidden my flex flex-wrap w-full"
              >
                <IPFSRenderer
                  src={listing.image}
                  width={500}
                  height={500}
                  alt="Listing Image"
                />
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
            Enter your information, confirm the transaction and wait to receive
            an email from the vendor.
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
                    setShippingInfo({
                      ...shippingInfo,
                      postalCode: target.value,
                    })
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
              buyListing()
            }}
            className="mt-4 w-full gradient-2 rounded-[5vmax]"
            isDisabled={isLoading || !teamEmail || !recipient}
          />
          {isLoading && (
            <p>Do not leave the page until the transaction is complete.</p>
          )}
        </form>
      </div>
    </Modal>
  )
}
