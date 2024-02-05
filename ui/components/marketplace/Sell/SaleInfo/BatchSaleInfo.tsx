import { useContract, Web3Button } from '@thirdweb-dev/react'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast, { Toaster } from 'react-hot-toast'
import {
  AuctionSubmission,
  DirectSubmission,
} from '../../../../lib/marketplace/marketplace-utils'
import toastStyle from '../../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS, MOONEY_ADDRESSES } from '../../../../const/config'
import { PrivyWeb3Button } from '../../../privy/PrivyWeb3Button'

type Props = {
  nft: any
  contractAddress: string
  walletAddress: any
  setSelectedNft: Function
  batchType: 'direct' | 'auction' | undefined
  listingBatch: any
  auctionBatch: any
}

type AuctionFormData = {
  nftContractAddress: string
  tokenId: any
  startDate: Date
  quantity: string
  endDate: Date
  floorPrice: string
  buyoutPrice: string
}

type DirectFormData = {
  nftContractAddress: string
  tokenId: any
  quantity: string
  price: string
  startDate: Date
  endDate: Date
}

export default function BatchSaleInfo({
  nft,
  contractAddress,
  walletAddress,
  setSelectedNft,
  batchType,
  listingBatch,
  auctionBatch,
}: Props) {
  const { contract: nftCollection } = useContract(contractAddress)

  const chainName =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'polygon' : 'mumbai'

  // Manage form submission state using tabs and conditional rendering
  const [tab, setTab] = useState<'direct' | 'auction'>('direct')

  //Check if user has balance for quanity
  function checkBalance(quantity: string | number) {
    const batch =
      batchType === 'direct'
        ? listingBatch.data.listings
        : auctionBatch.data.auctions
    const hasBalance = nft && nft.quantityOwned >= +quantity
    !hasBalance && toast.error('Insufficient balance')
    return hasBalance
  }
  // User requires to set marketplace approval before listing
  async function checkAndProvideApproval() {
    try {
      const hasApproval = await nftCollection?.call(
        'isApprovedForAll',

        [walletAddress || nft.owner, MARKETPLACE_ADDRESS]
      )

      // If it is, provide approval
      if (!hasApproval) {
        const txResult = await nftCollection?.call('setApprovalForAll', [
          MARKETPLACE_ADDRESS,
          true,
        ])

        if (txResult) {
          toast.success('Marketplace approval granted', {
            icon: '👍',
            style: toastStyle,
            position: 'bottom-center',
          })
        }
      }

      return true
    } catch (err) {
      console.error(err)
    }
  }

  // Manage form values using react-hook-form library: Auction form
  const { register: registerAuction, handleSubmit: handleSubmitAuction } =
    useForm<AuctionFormData>({
      defaultValues: {
        nftContractAddress: contractAddress,
        tokenId: nft.metadata.id,
        startDate: new Date(),
        quantity: '1',
        endDate: new Date(),
        floorPrice: '0',
        buyoutPrice: '0',
      },
    })

  // Manage form values using react-hook-form library: Direct form
  const { register: registerDirect, handleSubmit: handleSubmitDirect } =
    useForm<DirectFormData>({
      defaultValues: {
        nftContractAddress: contractAddress,
        tokenId: nft.metadata.id,
        quantity: '1',
        startDate: new Date(),
        endDate: new Date(),
        price: '0',
      },
    })

  //handle direct listing
  async function handleSubmissionAuction(data: AuctionFormData) {
    if (!checkBalance(data.quantity)) return

    await checkAndProvideApproval()
    const startDate: any = new Date(data.startDate).valueOf() / 1000
    const endDate: any = new Date(data.endDate).valueOf() / 1000

    const auction: AuctionSubmission = {
      assetContractAddress: data.nftContractAddress,
      tokenId: data.tokenId,
      quantity: nft.type === 'ERC1155' ? data.quantity : '1',
      currencyContractAddress: MOONEY_ADDRESSES[chainName],
      minimumBidAmount: String(+data.floorPrice),
      buyoutBidAmount: String(+data.buyoutPrice),
      timeBufferInSeconds: '900', //15 minutes
      bidBufferBps: '500',
      startTimestamp: startDate,
      endTimestamp: endDate,
    }
    const batchData = { auction, nft } //pass auction w/ nft so it can render in manage batch

    auctionBatch.addAuction(batchData)
    setSelectedNft(undefined)
    toast('The auction was successfully added to the batch!', {
      icon: '🚀',
      style: toastStyle,
      position: 'bottom-center',
    })
  }

  //handle auction listing
  async function handleSubmissionDirect(data: DirectFormData) {
    if (!checkBalance(data.quantity)) return
    await checkAndProvideApproval()
    const startDate: any = new Date(data.startDate).valueOf() / 1000
    const endDate: any = new Date(data.endDate).valueOf() / 1000
    const listing: DirectSubmission = {
      assetContractAddress: contractAddress,
      tokenId: data.tokenId,
      quantity: nft.type === 'ERC1155' ? data.quantity : '1',
      currencyContractAddress: MOONEY_ADDRESSES[chainName],
      pricePerToken: String(+data.price),
      startTimestamp: startDate,
      endTimestamp: endDate,
      isReservedListing: false,
    }

    const batchData = { listing, nft } //pass listing w/ nft so it can render in manage batch
    listingBatch.addListing(batchData)
    setSelectedNft(undefined)
    toast('The listing was successfully added to batch!', {
      icon: '🚀',
      style: toastStyle,
      position: 'bottom-center',
    })
  }

  //set tab to batch type
  useEffect(() => {
    if (batchType) {
      setTab(batchType)
    }
  }, [batchType])

  return (
    <>
      <Toaster position="bottom-center" reverseOrder={false} />
      <div className="-mt-8">
        <div className="w-full flex justify-start border-b-[1px] border-white border-opacity-60 mt-4 mb-4">
          <h3
            className={`p-4 text-base font-semibold text-white text-opacity-60 cursor-pointer transition-all duration-100 hover:text-opacity-80 ${
              tab === 'direct'
                ? 'text-opacity-100 border-b-2 border-moon-white'
                : ''
            }`}
            onClick={() =>
              !batchType || batchType === 'direct'
                ? setTab('direct')
                : toast.error(
                    'This is an auction batch. Please select auction tab to view auction details'
                  )
            }
          >
            Direct
          </h3>
          <h3
            className={`p-4 text-base font-semibold text-white text-opacity-60 cursor-pointer transition-all duration-100 hover:text-opacity-80 ${
              tab === 'auction'
                ? 'text-opacity-100 border-b-2 border-moon-white'
                : ''
            }`}
            onClick={() =>
              !batchType || batchType === 'auction'
                ? setTab('auction')
                : toast.error(
                    'This is a direct batch. Please select direct tab to view direct details'
                  )
            }
          >
            Auction
          </h3>
        </div>
        <>
          <>
            {/* Direct listing fields */}
            <div
              className={`py-2 flex flex-col ${
                tab === 'direct'
                  ? 'opacity-100'
                  : 'hidden opacity-0 h-0 transition-all duration-100'
              }`}
            >
              {/* Input field for ERC1155 quantity */}
              {nft.type === 'ERC1155' && (
                <>
                  <legend className="text-white text-opacity-80 m-0 mb-2">
                    {' '}
                    Quantity{' '}
                  </legend>
                  <div className="flex items-center">
                    <input
                      className="block w-[25%] py-3 ml-[2px] px-4 mb-4 bg-transparent border-none text-base rounded-lg ring-1 ring-moon-white ring-opacity-50"
                      type="number"
                      min={1}
                      {...registerDirect('quantity')}
                      onChange={(e) => {
                        if (+e.target.value > nft.quantityOwned) {
                          e.target.value = nft.quantityOwned
                          toast.error(
                            `You can't list more than ${nft.quantityOwned} of this asset`,
                            { style: toastStyle }
                          )
                        }
                      }}
                    />
                    <h3
                      className={`relative right-[-5%] bottom-2 text-2xl ${
                        !nft && 'animate-pulse'
                      }`}
                    >{`/ ${nft.quantityOwned || '/ ...'}`}</h3>
                  </div>
                  <p className="text-[80%] italic opacity-60">
                    *list multiple assets*
                  </p>
                </>
              )}
              <h4 className="mt-6 mb-3">Duration </h4>
              {/* Input field for auction start date */}
              <legend className="text-white text-opacity-80 m-0 mb-2">
                {' '}
                Listing Starts on{' '}
              </legend>
              <input
                className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                type="datetime-local"
                min={new Date(
                  Date.now() - new Date().getTimezoneOffset() * 60000
                )
                  .toISOString()
                  .slice(0, -8)}
                {...registerDirect('startDate')}
                aria-label="Auction Start Date"
              />
              {/* Input field for auction end date */}
              <legend className="text-white text-opacity-80 m-0 mb-2">
                {' '}
                Listing Ends on{' '}
              </legend>
              <input
                className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                type="datetime-local"
                min={new Date(
                  Date.now() - new Date().getTimezoneOffset() + 1428 * 60000
                )
                  .toISOString()
                  .slice(0, -8)}
                {...registerDirect('endDate')}
                aria-label="Auction End Date"
              />
              {
                <>
                  <h4 className="mt-6 mb-3">Price </h4>
                  <legend className="text-white text-opacity-80 m-0 mb-2">
                    {' '}
                    {'Price per asset'}
                  </legend>
                  <input
                    className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                    type="number"
                    step={1}
                    {...registerDirect('price')}
                  />

                  <PrivyWeb3Button
                    label="Add Listing to Batch"
                    className={`hover:!text-title-light 
                      bg-slate-300
                      dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
                    action={async () =>
                      await handleSubmitDirect(handleSubmissionDirect)()
                    }
                  />
                </>
              }
            </div>

            {/* Auction listing fields */}
            <div
              className={`py-2 ${
                tab === 'auction'
                  ? 'flex flex-col opacity-100'
                  : 'hidden opacity-0 h-0 transition-all duration-100'
              }`}
              style={{ flexDirection: 'column' }}
            >
              {/* Input field for quantity */}
              {nft.type === 'ERC1155' && (
                <>
                  <legend className="text-white text-opacity-80 m-0 mb-2">
                    {' '}
                    Quantity{' '}
                  </legend>
                  <div className="flex items-center">
                    <input
                      className="block w-[25%] py-3 ml-[2px] px-4 mb-4 bg-transparent border-none text-base rounded-lg ring-1 ring-moon-white ring-opacity-50"
                      type="number"
                      min={1}
                      {...registerAuction('quantity')}
                      onChange={(e) => {
                        if (+e.target.value > nft?.quantityOwned) {
                          e.target.value = nft.quantityOwned
                          toast.error(
                            `You can't list more than ${nft.quantityOwned} of this asset`,
                            { style: toastStyle }
                          )
                        }
                      }}
                    />
                    <h3
                      className={`relative right-[-5%] bottom-2 text-2xl ${
                        !nft && 'animate-pulse'
                      }`}
                    >{`/ ${nft.quantityOwned || '/ ...'}`}</h3>
                  </div>
                  <p className="text-[80%] italic opacity-60">
                    *list multiple assets as a bundle*
                  </p>
                </>
              )}

              <h4 className="mt-6 mb-3">Duration </h4>

              {/* Input field for auction start date */}
              <legend className="text-white text-opacity-80 m-0 mb-2">
                {' '}
                Auction Starts on{' '}
              </legend>
              <input
                className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                type="datetime-local"
                min={new Date(
                  Date.now() - new Date().getTimezoneOffset() * 60000
                )
                  .toISOString()
                  .slice(0, -8)}
                {...registerAuction('startDate')}
                aria-label="Auction Start Date"
              />

              {/* Input field for auction end date */}
              <legend className="text-white text-opacity-80 m-0 mb-2">
                {' '}
                Auction Ends on{' '}
              </legend>
              <input
                className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                type="datetime-local"
                min={new Date(
                  Date.now() - new Date().getTimezoneOffset() + 1428 * 60000
                )
                  .toISOString()
                  .slice(0, -8)}
                {...registerAuction('endDate')}
                aria-label="Auction End Date"
              />
              <h4 className="mt-6 mb-3">Price </h4>

              {/* Input field for minimum bid price */}
              <legend className="text-white text-opacity-80 m-0 mb-2">
                {' '}
                Allow bids starting from{' '}
              </legend>
              <input
                className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                step={1}
                type="number"
                {...registerAuction('floorPrice')}
              />

              {/* Input field for buyout price */}
              <legend className="text-white text-opacity-80 m-0 mb-2">
                {' '}
                Buyout price for asset or bundle{' '}
              </legend>
              <input
                className="block w-[98%] py-3 px-4 mb-4 bg-transparent border-none text-base rounded-lg ml-[2px] ring-1 ring-moon-white ring-opacity-50"
                type="number"
                step={1}
                {...registerAuction('buyoutPrice')}
              />

              <PrivyWeb3Button
                label="Add Auction to Batch"
                className={`hover:!text-title-light 
                   bg-slate-300
                   dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
                action={async () =>
                  await handleSubmitAuction(handleSubmissionAuction)()
                }
              />
              {/* info */}
              <div className="flex flex-col gap-2 text-[80%] opacity-60 p-2 mt-4 bg-[#1d1d1d] rounded-lg bg-opacity-60">
                <h1 className="text-[110%]">Auction Info:</h1>
                <p className="">
                  *Once a bid is placed, the auction cannot be cancelled.*
                </p>
                <p>
                  *Buyout: If an auction is bought out, the bidder will receive
                  the asset and the seller will receive the payout
                  automatically.*
                </p>
                <p>
                  *Bids: If an auction expires with a winning bid, the buyer or
                  seller will have to close the auction by claiming their asset
                  or payout.*
                </p>
              </div>
            </div>
          </>
        </>
      </div>
    </>
  )
}
