import { getAccessToken } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import ERC20ABI from 'const/abis/ERC20.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  CITIZENSHIP_GIFT_TAG,
  DAI_ADDRESSES,
  TEAM_ADDRESSES,
  MOONEY_ADDRESSES,
  USDC_ADDRESSES,
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
} from 'const/config'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction, toUnits } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount, useWalletBalance } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useCitizenEmail from '@/lib/citizen/useCitizenEmail'
import {
  computePurchasePrice,
  evaluateUsdcPurchase,
  parseListingPrice,
  parseUsdcBalance,
} from '@/lib/marketplace/usdcListingPurchase'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { truncateTokenValue } from '@/lib/utils/numbers'
import { FundOnramp } from '@/components/onramp/FundOnramp'
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

  // Gift-a-citizenship listing: a flat-priced ETH listing on the EB team that
  // issues a one-time free-citizen invite link to the buyer on purchase.
  const isGift = listing.tag === CITIZENSHIP_GIFT_TAG

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
  const [giftLink, setGiftLink] = useState<string>()

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

  const numericPrice = useMemo(
    () => parseListingPrice(listing.price),
    [listing.price]
  )

  // Final USDC/ETH/etc amount the buyer will pay (includes non-citizen markup).
  const purchasePrice = useMemo(
    () =>
      computePurchasePrice({
        price: listing.price,
        isGift,
        isCitizen: !!citizen,
      }),
    [listing.price, isGift, citizen]
  )

  // USDC onramp: when a listing is priced in USDC and the wallet doesn't hold
  // enough on Arbitrum, surface the shared FundOnramp flow for the deficit.
  const isUsdcListing = listing.currency === 'USDC'
  const usdcAddress = USDC_ADDRESSES[chainSlug] as `0x${string}` | undefined
  const {
    data: usdcBalanceData,
    refetch: refetchUsdcBalance,
    isLoading: isUsdcBalanceLoading,
  } = useWalletBalance({
    client,
    address: account?.address,
    chain: selectedChain,
    tokenAddress: isUsdcListing ? usdcAddress : undefined,
  })

  const usdcBalance = useMemo(
    () =>
      isUsdcListing ? parseUsdcBalance(usdcBalanceData?.displayValue) : null,
    [isUsdcListing, usdcBalanceData]
  )

  const { hasEnoughUsdc, usdcDeficit } = useMemo(
    () =>
      evaluateUsdcPurchase({
        isUsdcListing,
        usdcBalance,
        purchasePrice,
      }),
    [isUsdcListing, usdcBalance, purchasePrice]
  )

  const [awaitingUsdcOnramp, setAwaitingUsdcOnramp] = useState(false)

  // Poll USDC after an in-app onramp so the Buy button appears once funds land.
  useEffect(() => {
    if (!awaitingUsdcOnramp || !isUsdcListing) return
    if (hasEnoughUsdc) {
      setAwaitingUsdcOnramp(false)
      return
    }
    const id = setInterval(() => {
      refetchUsdcBalance()
    }, 10_000)
    return () => clearInterval(id)
  }, [
    awaitingUsdcOnramp,
    isUsdcListing,
    hasEnoughUsdc,
    refetchUsdcBalance,
  ])

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

    // Gifted citizenship is always the flat citizen price (no markup).
    const price = purchasePrice

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

        // The payment has already settled by this point, so the
        // notification step must never throw. `teamNFT` can be missing when its
        // lookup was rate-limited even though `resolvedRecipient` resolved from
        // the parent-provided recipient — fall back to the listing's team data
        // so a null dereference can't turn a successful purchase into a
        // "Purchase failed" toast with no vendor notification.
        const teamSlug = teamNFT?.metadata?.name
          ? generatePrettyLink(teamNFT.metadata.name)
          : listing.teamName
          ? generatePrettyLink(listing.teamName)
          : listing.teamId

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
            teamLink: `${DEPLOYED_ORIGIN}/team/${teamSlug}`,
            isGift,
            listingId: listing.id,
            teamId: listing.teamId,
            accessToken,
          }),
        })

        const {
          success,
          message: responseMessage,
          giftLink: returnedGiftLink,
        } = await res.json()

        if (success) {
          if (isGift && returnedGiftLink) {
            // Keep the modal open so the buyer can copy/share the gift link.
            setGiftLink(returnedGiftLink)
            toast.success('Purchase complete! Your gift link is ready below.', {
              duration: 10000,
            })
            setIsLoading(false)
            return
          }
          if (isGift && !returnedGiftLink) {
            // Payment went through but the gift link was never issued. Don't
            // close with a misleading generic success — surface it so the buyer
            // (and support) know the link still needs to be recovered.
            toast.error(
              'Your payment went through, but we could not generate your gift link. Please contact support with your transaction to claim it.',
              { duration: 12000 }
            )
            setIsLoading(false)
            return
          }
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
      {giftLink ? (
        <div className="w-full flex flex-col gap-4 items-start justify-start">
          <p className="font-GoodTimes">Your gift is ready!</p>
          <p className="opacity-80 text-[90%]">
            Share this one-time link with the person you want to gift a
            citizenship to. They can use it to mint their free citizenship. A
            copy has also been sent to your email.
          </p>
          <div className="w-full flex gap-2 items-center bg-darkest-cool rounded-[10px] p-3">
            <p className="break-all text-[85%]">{giftLink}</p>
          </div>
          <div className="w-full flex gap-2">
            <button
              type="button"
              className="gradient-2 rounded-[5vmax] px-4 py-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(giftLink)
                  toast.success('Gift link copied to clipboard.')
                } catch {
                  toast.error('Could not copy. Please copy the link manually.')
                }
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              className="rounded-[5vmax] px-4 py-2 border border-white/20"
              onClick={() => setEnabled(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
      <form
        className="w-full flex flex-col gap-3 items-start justify-start"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <div className="w-full flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          {listing.image && (
            <div
              id="image-container"
              className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl"
            >
              <IPFSRenderer
                src={listing.image}
                width={160}
                height={160}
                alt="Listing Image"
                className="object-cover"
                fillContainer
              />
              <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                {`#${listing.id}`}
              </span>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="font-GoodTimes text-base leading-tight text-white">{listing.title}</h3>
            <p className="text-xs leading-snug text-white/60 line-clamp-2">
              {listing.description}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <p id="listing-price" className="font-GoodTimes text-lg text-white">{`${
                truncateTokenValue(purchasePrice, listing.currency)
              } ${listing.currency}`}</p>
              {!citizen && !isGift && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                  +10% non-citizen fee
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs opacity-60">
          {isGift
            ? 'Enter your email and confirm the transaction. You will receive a one-time link to gift a free citizenship to whoever you choose.'
            : "Enter your details and confirm the transaction. You'll receive a confirmation email from the vendor."}
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
          <div className="w-full flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="font-GoodTimes text-xs text-white">Shipping Address</p>
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
        {isUsdcListing && account?.address && !hasEnoughUsdc && (
          <div
            data-testid="marketplace-usdc-onramp"
            className="w-full flex flex-col gap-3"
          >
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-amber-100 text-sm font-medium">
                You need USDC on Arbitrum to buy this listing
              </p>
              <p className="text-amber-100/70 text-xs mt-1 leading-relaxed">
                {isUsdcBalanceLoading || usdcBalance == null
                  ? `Add ${truncateTokenValue(
                      purchasePrice,
                      'USDC'
                    )} USDC to your wallet to continue.`
                  : `Your wallet has ${truncateTokenValue(
                      usdcBalance,
                      'USDC'
                    )} USDC. Add ${truncateTokenValue(
                      usdcDeficit,
                      'USDC'
                    )} more to cover this purchase.`}
              </p>
              {awaitingUsdcOnramp && (
                <p className="text-amber-100/60 text-xs mt-2">
                  Waiting for USDC to arrive…
                </p>
              )}
            </div>
            {usdcDeficit > 0 && (
              <FundOnramp
                fullWidth
                address={account.address}
                selectedChain={selectedChain}
                ethAmount={usdcDeficit}
                asset="USDC"
                coinbaseRedirectUrl={`${DEPLOYED_ORIGIN}/marketplace?onrampSuccess=true`}
                checkBalanceSufficient={async () => {
                  const result = await refetchUsdcBalance()
                  const next = result?.data?.displayValue
                  if (next == null) return false
                  const n = Number(next)
                  return Number.isFinite(n) && n >= purchasePrice
                }}
                refetchBalance={async () => {
                  await refetchUsdcBalance()
                }}
                onBalanceSufficient={() => {
                  setAwaitingUsdcOnramp(false)
                }}
                onCoinbaseSuccessInApp={() => {
                  setAwaitingUsdcOnramp(true)
                }}
                onMoonPayPurchaseSubmitted={() => {
                  setAwaitingUsdcOnramp(true)
                }}
              />
            )}
          </div>
        )}
        {(!isUsdcListing || !account?.address || hasEnoughUsdc) && (
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
              if (isUsdcListing && !hasEnoughUsdc) {
                return toast.error(
                  'You need more USDC on Arbitrum before purchasing.'
                )
              }
              await buyListing()
            }}
            className="w-full gradient-2 rounded-[5vmax]"
            isDisabled={isLoading || !resolvedRecipient}
          />
        )}
        {!resolvedRecipient && !isLoading && (
          <p className="w-full text-center text-sm opacity-60">Loading vendor details...</p>
        )}
        {isLoading && (
          <p className="w-full text-center text-sm opacity-60">
            Do not leave the page until the transaction is complete.
          </p>
        )}
      </form>
      )}
    </Modal>
  )
}
