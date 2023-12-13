import { Mumbai } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  useAddress,
  useContract,
  useContractRead,
  useOwnedNFTs,
} from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import ChainContext from '../../lib/thirdweb/chain-context'
import { useHandleRead, useHandleWrite } from '../../lib/thirdweb/hooks'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'
import { useMerkleProof } from '../../lib/utils/hooks/useMerkleProof'
import Head from '../../components/layout/Head'
import { collectionMetadata } from '../../components/marketplace/assets/seed'
import { PrivyWeb3Button } from '../../components/privy/PrivyWeb3Button'
import { SubmitTTSInfoModal } from '../../components/ticket-to-space/SubmitTTSInfoModal'
import { ViewNFTDataModal } from '../../components/ticket-to-space/ViewNFTDataModal'
import ERC20 from '../../const/abis/ERC20.json'
import ttsSweepstakesV2 from '../../const/abis/ttsSweepstakesV2.json'
import { devWhitelist } from '../../const/tts/whitelist'

const TICKET_TO_SPACE_ADDRESS = '0x5283b6035cfa7bb884b7F6A146Fa6824eC9773c7' //mumbai

export default function Sweepstakes({ nftMetadata, mongoMoondaoApiKey }: any) {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)
  const router = useRouter()

  const [time, setTime] = useState<string>()
  const [quantity, setQuantity] = useState(1)
  const [supply, setSupply] = useState(0)
  const [enableMintInfoModal, setEnableMintInfoModal] = useState(false)
  const [enableFreeMintInfoModal, setEnableFreeMintInfoModal] = useState(false)
  const [enableViewNFTsModal, setViewNFTsModal] = useState(false)

  const address = useAddress()

  const whitelist = devWhitelist
  const merkleProof = useMerkleProof(whitelist)
  const { contract: ttsContract } = useContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )

  const { contract: mooneyContract } = useContract(
    '0x0A720b8985A167fA4be98279980cA4b1715e741e',
    ERC20.abi
  ) //mumbai mooney

  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    ethers.utils.parseEther(String(20000 * quantity)),
    BigNumber.from(0),
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address,
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: ownedNfts } = useOwnedNFTs(ttsContract, address)

  const { data: balance } = useContractRead(ttsContract, 'balanceOf', [address])

  const { mutateAsync: mint } = useHandleWrite(ttsContract, 'mint', [
    BigNumber.from(quantity || 0),
  ])

  const { mutateAsync: claimFree } = useHandleWrite(ttsContract, 'claimFree', [
    merkleProof,
  ])

  const { data: canClaimFree } = useHandleRead(ttsContract, 'canClaimFree', [
    merkleProof,
    address,
  ])

  const openViewNFTs = (e: any) => {
    e.preventDefault();
    setViewNFTsModal(true)
  };

  useEffect(() => {
    console.log('Can Claim Free', canClaimFree)
  }, [canClaimFree])

  useEffect(() => {
    setSelectedChain(Mumbai)
    const ts = Math.floor(1704067200 - new Date().valueOf() / 1000)
    if (ts > 86400) setTime('T-' + Math.floor(ts / 86400) + ' Days')
    else if (ts > 3600) setTime('T-' + Math.floor(ts / 3600) + ' Hours')
    else if (ts > 60) setTime('T-' + Math.floor(ts / 60) + ' Minutes')
    else if (ts > 0) setTime('T-' + ts + ' Seconds')
    else 'Expired'
  }, [])

  useEffect(() => {
    if (ttsContract) {
      ttsContract
        .call('getSupply')
        .then((supply: any) => setSupply(supply.toString()))
        .catch((err: any) => console.log(err))
    }
  }, [ttsContract])

  return (
    <main className="animate-fadeIn">
      <Head title="Ticket to Space" />
      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
        <h1 className={`page-title`}>Ticket to Space</h1>
        {/* <h3 className="mt-5 lg:mt-8 font-bold text-center lg:text-left text-lg lg:text-xl xl:text-2xl">
          Take the leap, for the chance to win a trip to space!
        </h3> */}
        <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-sm xl:text-base">
          Take the leap, for the chance to win a trip to space!
        </p>

        <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base">
          The Ticket to Space Sweepstakes is on Polygon. Learn how to bridge
          your $MOONEY
          <a
            className="text-moon-gold"
            href="https://youtu.be/oQtHjbcbAio?feature=shared"
          >
            {' '}
            here
          </a>
          .
        </p>

        <div className="">
          <p className="mt-5 text-sm lg:mt-6 opacity-70 max-w-2xl lg:max-w-3xl font-RobotoMono text-center lg:text-left lg:text-base xl:text-lg">
            We will randomly select an owner to win a trip to space on a future
            Blue Origin rocket! Every individual may mint up to 50 entries.
          </p>
        </div>

        {/*Collection title, image and description*/}
        <div className="mt-6 inner-container-background relative w-full">
          {collectionMetadata && (
            <div className="flex flex-col bg-transparent p-4 md:p-5 lg:p-6 xl:p-[30px]">
              <div className="md:flex">
                <div className="m-auto my-2 p-2 flex justify-center">
                  <MediaRenderer src={nftMetadata.image} width={'300px'} />
                </div>
                {/*Quantity, price, expiration, balance */}
                <div className="flex flex-col justify-center m-auto mt-4 lg:mt-4 gap-2 lg:gap-4">
                  <div>
                    <p className="opacity-70 lg:text-xl">Total Minted</p>
                    <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                      {supply
                        ? supply + (supply > 1 ? ' Tickets' : ' Ticket')
                        : '...loading'}
                    </p>
                  </div>

                  {/* Pricing information */}
                  <div>
                    <p className="opacity-70 lg:text-xl">Price</p>
                    <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                      20,000 MOONEY
                    </p>
                  </div>
                  {/*Expiration*/}
                  <div>
                    <p className="opacity-70 lg:text-xl">Expiration</p>
                    <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                      {time}
                    </p>
                  </div>

                  {/* Wallet Balance */}
                  <div>
                    <p className="opacity-70 lg:text-xl">Your Balance</p>
                    <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                      {balance
                        ? balance.toString() +
                          (balance > 1 ? ' Tickets' : ' Ticket')
                        : '...'}
                    </p>
                  </div>

                  {/* Owned NFTs Info */}
                  <div>
                    <button 
                      className="opacity-70 lg:text-xl"
                      onClick={openViewNFTs}
                    >
                      View your NFTs
                    </button>
                    {enableViewNFTsModal && 
                      <ViewNFTDataModal
                        ttsContract={ttsContract}
                        setEnabled={setViewNFTsModal}
                      />
                    }
                  </div>
                </div>
              </div>

              {/*Not definitive, this one is being used on another page*/}
              <div className="mt-4 flex flex-col gap-8">
                <div className="block">
                  <div>
                    <p className="mb-1 text-white lg:text-xl">
                      Quantity to Mint
                    </p>
                    <div className="h-[58px] flex w-[250px] md:w-[400px] bg-white bg-opacity-5 justify-between p-2 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40">
                      <input
                        className="ml-2 w-1/2 text-white bg-transparent focus:outline-none"
                        type="number"
                        step={1}
                        max={balance ? 50 - +balance : 0}
                        min={1}
                        placeholder={'1'}
                        onChange={(e: any) => {
                          if (e.target.value > 50 - balance) {
                            toast.error('Cannot mint more than 50')
                            setQuantity(50 - balance)
                          }
                          else if (e.target.value < 1) {
                            toast.error('Mint quantity must be at least 1')
                            console.log(e.target.value)
                            setQuantity(1)
                          }
                          else {
                            setQuantity(e.target.value)
                          }
                        }}
                        value={quantity}
                      />
                      <PrivyWeb3Button
                        className="text-white rounded-none bg-moon-orange w-[160px]"
                        label="Mint"
                        action={() => setEnableMintInfoModal(true)}
                      />
                    </div>
                  </div>
                  {enableMintInfoModal && (
                    <SubmitTTSInfoModal
                      balance={balance}
                      quantity={quantity}
                      supply={supply}
                      approveToken={approveToken}
                      mint={mint}
                      setEnabled={setEnableMintInfoModal}
                      ttsContract={ttsContract}
                      mooneyContract={mooneyContract}
                    />
                  )}
                </div>
                {whitelist.includes(address || '') && canClaimFree ? (
                  <>
                    <div className="w-full border-2 opacity-50" />
                    <div className="flex gap-8">
                      <PrivyWeb3Button
                        className="text-white rounded-none bg-moon-orange w-[160px]"
                        label="Claim Free"
                        action={() => setEnableFreeMintInfoModal(true)}
                      />
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
                    <div className="flex flex-col items-center gap-4">
                      {enableFreeMintInfoModal && (
                        <SubmitTTSInfoModal
                          quantity={quantity}
                          balance={balance}
                          supply={supply}
                          claimFree={claimFree}
                          setEnabled={setEnableFreeMintInfoModal}
                          ttsContract={ttsContract}
                          mooneyContract={mooneyContract}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <></>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm">
          NO PURCHASE NECESSARY TO ENTER. PURCHASE WILL NOT INCREASE YOUR ODDS
          OF WINNING.  NO PURCHASE OF A TICKET TO SPACE NFT IS NECESSARY TO
          ENTER THE SWEEPSTAKES OR WIN A CHANCE TO FLY TO SPACE.  PURCHASE OF A
          TICKET TO SPACE NFT WILL NOT INCREASE YOUR ODDS OF WINNING A PRIZE.
          Sweepstakes are open only to individuals who are 18 years of age or
          older, or the age of majority if greater than 18 in their respective
          jurisdictions. Sweepstakes is void in Florida, New York,Puerto Rico
          and where otherwise prohibited by law. Alternate prize winners are
          responsible for taxes associated with the prizes. Odds of winning
          depend on the number of entries received during the contest period,
          but can be calculated by dividing the number of prizes by the total
          number of entries received. Sponsor: LuckDAO Limited d/b/a MoonDAO.
          Contest ends on January 15th 2024. For Alternative Method of Entry,
          <a
            className="text-moon-gold"
            href="https://publish.obsidian.md/moondao/MoonDAO/docs/Ticket+to+Space+NFT/Ticket+to+Space+Sweepstakes+Rules"
          >
            {' '}
            click here
          </a>
          .
        </p>
      </div>
    </main>
  )
}

export async function getStaticProps() {
  const sdk = initSDK(Mumbai)

  const ticketToSpaceContract = await sdk.getContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )

  const nftMetadata = await ticketToSpaceContract?.erc721.getTokenMetadata(0)
  // TODO: Change to production db
  const mongoMoondaoApiKey = process.env.MONGO_MOONDAO_API_KEY

  return {
    props: {
      nftMetadata,
      mongoMoondaoApiKey,
    },
  }
}
