import { Mumbai } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  useAddress,
  useContract,
  useOwnedNFTs,
} from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import ChainContext from '../../lib/thirdweb/chain-context'
import { useHandleWrite } from '../../lib/thirdweb/hooks'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'
import { useMerkleProof } from '../../lib/utils/hooks/useMerkleProof'
import Head from '../../components/layout/Head'
import { collectionMetadata } from '../../components/marketplace/assets/seed'
import { PrivyWeb3Button } from '../../components/privy/PrivyWeb3Button'
import { SubmitTTSInfoModal } from '../../components/ticket-to-space/SubmitTTSInfoModal'
import ERC20 from '../../const/abis/ERC20.json'
import ttsSweepstakesV2 from '../../const/abis/ttsSweepstakesV2.json'
import { devWhitelist } from '../../const/tts/whitelist'

const TICKET_TO_SPACE_ADDRESS = '0xFB8f14dE03A8edA036783F0b81992Ea7ce7ce8B5' //mumbai

export default function Ticket2Space({ sweepstakesSupply, nftMetadata }: any) {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)
  const router = useRouter()

  const [time, setTime] = useState<string>()
  const [quantity, setQuantity] = useState(1)
  const [supply, setSupply] = useState(sweepstakesSupply)
  const [enableMintInfoModal, setEnableMintInfoModal] = useState(false)
  const [enableFreeMintInfoModal, setEnableFreeMintInfoModal] = useState(false)

  const address = useAddress()

  const whitelist = devWhitelist.split('\n')
  const merkleProof = useMerkleProof(whitelist)
  const { contract: ttsContract } = useContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )

  const { contract: mooneyContract } = useContract(
    '0x3818f3273D1f46259b737342Ad30e576A7A74f09',
    ERC20.abi
  ) //mumbai mooney

  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    ethers.utils.parseEther(String(100 * quantity)),
    BigNumber.from(0),
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address,
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: ownedNfts } = useOwnedNFTs(ttsContract, address)

  const { mutateAsync: mint } = useHandleWrite(ttsContract, 'mint', [
    BigNumber.from(quantity || 0),
  ])

  const { mutateAsync: claimFree } = useHandleWrite(ttsContract, 'claimFree', [
    merkleProof,
  ])

  useEffect(() => {
    setSelectedChain(Mumbai)
    setTime(
      new Date().toLocaleDateString() + ' @ ' + new Date().toLocaleTimeString()
    )
  }, [])

  useEffect(() => {
    if (ttsContract) {
      ttsContract
        .call('getSupply')
        .then((supply: any) => setSupply(supply.toString()))
        .catch((err: any) => console.log(err))
      console.log(supply)
    }
  }, [ttsContract])

  return (
    <main className="animate-fadeIn">
      <Head title="Ticket to Space" />

      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
        <h1 className={`page-title`}>Ticket to Space</h1>
        <h3 className="mt-5 lg:mt-8 font-bold text-center lg:text-left text-lg lg:text-xl xl:text-2xl">
          Take the leap, for the chance to win a trip to space!
        </h3>

        <div className="">
          <p className="mt-5 text-sm lg:mt-6 opacity-70 max-w-2xl lg:max-w-3xl font-RobotoMono text-center lg:text-left lg:text-base xl:text-lg">
            Purchase this NFT and follow us on our journey to randomly select an
            owner to win a trip to space!
          </p>
        </div>

        {/*Collection title, image and description*/}
        <div className="mt-6 inner-container-background relative w-full xl:w-2/3">
          {collectionMetadata && (
            <div className="flex flex-col bg-transparent p-4 md:p-5 lg:p-6 xl:p-[30px]">
              <h1 className="text-center font-GoodTimes text-2xl lg:text-3xl xl:text- text-moon-orange dark:text-white">
                {'Ticket to Space NFT 2'}
              </h1>
              <div className="my-2 p-2 flex justify-center">
                <MediaRenderer src={nftMetadata.image} width={'300px'} />
              </div>
              {/*Quantity, price, expiration */}
              <div className="mt-4 lg:mt-5 flex flex-col gap-2 lg:gap-4">
                <div>
                  <p className="opacity-70 lg:text-xl">Quantity left</p>
                  <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                    {sweepstakesSupply ? 9060 - +supply : '...loading'}
                  </p>
                </div>

                {/* Pricing information */}
                <div>
                  <p className="opacity-70 lg:text-xl">Price</p>
                  <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                    100 MOONEY
                  </p>
                </div>
                {/*Expiration*/}
                <div>
                  <p className="opacity-70 lg:text-xl">Expiration</p>
                  <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                    {time}
                  </p>
                </div>
              </div>
              {/*Not definitive, this one is being used on another page*/}
              <div className="mt-4 flex flex-col gap-8">
                <div className="flex gap-4">
                  <PrivyWeb3Button
                    label="Mint"
                    action={() => setEnableMintInfoModal(true)}
                  />
                  <input
                    className="w-1/4 text-center text-black rounded-md"
                    type="number"
                    step={1}
                    placeholder={'0'}
                    onChange={(e: any) => {
                      if (quantity > 9060 - supply) {
                        toast.error('Cannot mint more than the supply')
                        return setQuantity(9060 - supply)
                      }

                      setQuantity(e.target.value)
                    }}
                    value={quantity}
                  />

                  {enableFreeMintInfoModal && (
                    <SubmitTTSInfoModal
                      quantity={quantity}
                      supply={supply}
                      action={async () => {
                        try {
                          if (tokenAllowance.toString() < 100 * 10 ** 18)
                            await approveToken()
                          toast.success('Approved Mooney to be spent')
                          await mint()
                          return true
                        } catch (err) {
                          toast.error('The transaction was rejected')
                        }
                      }}
                      setEnabled={setEnableMintInfoModal}
                      ttsContract={ttsContract}
                    />
                  )}
                </div>
                {whitelist.includes(address || '') && (
                  <>
                    <div className="w-full border-2 opacity-50" />
                    <div className="flex flex-col items-center gap-4">
                      <PrivyWeb3Button
                        label="Claim Free"
                        action={claimFree}
                        onSuccess={() => {
                          setEnableFreeMintInfoModal(true)
                        }}
                        onError={() => {
                          toast.error('The transaction was rejected')
                        }}
                      />
                      {enableFreeMintInfoModal && (
                        <SubmitTTSInfoModal
                          quantity={quantity}
                          supply={supply}
                          action={async () => {
                            try {
                              claimFree()
                              return true
                            } catch (err) {
                              toast.error('The transaction was rejected')
                            }
                          }}
                          setEnabled={setEnableFreeMintInfoModal}
                          ttsContract={ttsContract}
                        />
                      )}
                      <div className="flex flex-col gap-2">
                        <p className="text-[90%]">
                          {'Claim your free Ticket to Space NFT!'}
                        </p>
                        <p className="text-[80%] opacity-50">
                          {
                            '(One is available per address that entered the previous sweepstakes)'
                          }
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export async function getServerSideProps() {
  const sdk = initSDK(Mumbai)

  const ticketToSpaceContract = await sdk.getContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )
  const sweepstakesSupply = await ticketToSpaceContract?.call('getSupply')

  const nftMetadata = await ticketToSpaceContract?.erc721.getTokenMetadata(1)

  return {
    props: {
      sweepstakesSupply: sweepstakesSupply.toString(),
      nftMetadata,
    },
  }
}
