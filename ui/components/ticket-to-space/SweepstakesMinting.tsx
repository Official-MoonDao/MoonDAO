import { Ethereum, Polygon } from '@thirdweb-dev/chains'
import { MediaRenderer, useAddress, useOwnedNFTs } from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useHandleRead, useHandleWrite } from '../../lib/thirdweb/hooks'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'
import { useMerkleProof } from '../../lib/utils/hooks/useMerkleProof'
import { TICKET_TO_SPACE_ADDRESS } from '../../const/config'
import { devWhitelist } from '../../const/tts/whitelist'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { SubmitTTSInfoModal } from './SubmitTTSInfoModal'
import { SubmitTTSInfoModalETH } from './SubmitTTSInfoModalETH'
import { SweepstakesWinners } from './SweepstakesWinners'
import { ViewNFTDataModal } from './ViewNFTDataModal'

export function SweepstakesMinting({
  selectedChain,
  setSelectedChain,
  ttsContract,
  mooneyContract,
  mooneyETHContract,
}: any) {
  const address = useAddress()

  const [time, setTime] = useState<string>()
  const [quantity, setQuantity] = useState(1)
  const [supply, setSupply] = useState(0)
  const [enableMintInfoModal, setEnableMintInfoModal] = useState(false)
  const [enableEthMintInfoModal, setEnableEthMintInfoModal] = useState(false)
  const [enableFreeMintInfoModal, setEnableFreeMintInfoModal] = useState(false)
  const [enableViewNFTsModal, setViewNFTsModal] = useState(false)

  const whitelist = devWhitelist
  const merkleProof = useMerkleProof(whitelist)

  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    ethers.utils.parseEther(String(20000 * quantity)),
    BigNumber.from(0),
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: balance } = useHandleRead(ttsContract, 'balanceOf', [address])

  const { mutateAsync: mint } = useHandleWrite(ttsContract, 'mint', [
    BigNumber.from(quantity || 0),
  ])

  const { mutateAsync: burn } = useHandleWrite(mooneyETHContract, 'transfer', [
    '0x000000000000000000000000000000000000dead',
    ethers.utils.parseEther(String(20000 * quantity)),
  ])

  const { mutateAsync: claimFree } = useHandleWrite(ttsContract, 'claimFree', [
    merkleProof,
  ])

  const { data: canClaimFree } = useHandleRead(ttsContract, 'canClaimFree', [
    merkleProof,
    address,
  ])

  const openViewNFTs = (e: any) => {
    e.preventDefault()
    setViewNFTsModal(true)
  }

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address,
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: ownedNfts } = useOwnedNFTs(ttsContract, address)

  useEffect(() => {
    const ts = Math.floor(1705132740 - new Date().valueOf() / 1000)
    if (ts > 86400) setTime('T-' + Math.floor(ts / 86400) + ' Days')
    else if (ts > 3600) setTime('T-' + Math.floor(ts / 3600) + ' Hours')
    else if (ts > 60) setTime('T-' + Math.floor(ts / 60) + ' Minutes')
    else if (ts > 0) setTime('T-' + ts + ' Seconds')
    else setTime('Expired')
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
    <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
      <h1 className={`page-title flex text-lg`}>Ticket to Space</h1>
      {/* <h3 className="mt-5 lg:mt-8 font-bold text-center lg:text-left text-lg lg:text-xl xl:text-2xl">
          Take the leap, for the chance to win a trip to space!
        </h3> */}
      <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white px-2 py-2 xl:py-3 xl:px-4 w-full xl:w-[95%] xl:text-left text-sm xl:text-base">
        MoonDAO is sending regular people to space as one small step in our mission to accelerate a multiplanetary future for all.
      </p>
  
      {/* Highlighting Astronauts */}
<div className="mt-10 flex items-center">
  <div className="w-1/3">
    <img src="\assets\coby-cotton.png" alt="Coby Cotton" className="rounded-full float-right w-full h-auto" />
  </div>
  <div className="w-2/3 pl-4">
    <h2 className="text-xl font-bold">Coby Cotton: MoonDAO's First Astronaut</h2>
    <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
      Coby is one of the five cofounders of the YouTube channel Dude Perfect, the most-subscribed sports channel on YouTube and one of the most popular in the world with more than 57 million followers. He co-founded the sports entertainment channel known for specializing in trick shots and comedy videos in 2009 with his college roommates.
    </p>
    <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
      MoonDAO members voted to have Coby represent them on this flight and he flew as part of Blue Origin's NS-22 mission. <u><Link href="https://www.youtube.com/watch?v=YXXlSG-du7c" target="_blank">Watch the launch video</Link></u>.
    </p>
  </div>
</div>

<div className="mt-10 flex items-center">
  <div className="w-1/3 order-2 pl-4">
    <img src="\assets\eiman-jahangir.png" alt="Dr. Eiman Jahangir" className="rounded-full float-left w-full h-auto" />
  </div>
  <div className="w-2/3 order-1 pr-4">
    <h2 className="text-xl font-bold">Dr. Eiman Jahangir: MoonDAO's Second Astronaut</h2>
    <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
      Dr. Eiman Jahangir is a Cardiologist and Associate Professor of Medicine and Radiology at Vanderbilt University Medical Center, where he treats patients with heart disease and educates future physicians. Outside of medicine, he has a passion for exploration, including a lifelong dream of going to space. Over the past two decades, Eiman has been a NASA astronaut candidate finalist twice, participated in analog astronaut missions, and trained in various aspects of human spaceflight.
    </p>
    <p className="mt-3 text-[#1F212B] dark:text-white px-2 py-2 xl:py-3 xl:px-4 text-sm xl:text-base">
      Eiman was selected via the Ticket to Space sweepstakes and is a long-time member of MoonDAO. <u><Link href ="https://docs.moondao.com/Reference/Nested-Docs/About-Eiman-Jahangir" target="_blank">Read more about Eiman</Link></u>.
    </p>
  </div>
</div>


  

      {/*Collection title, image and description*/}
      <div className="mt-6 inner-container-background relative w-full">
        <div className="flex flex-col bg-transparent p-4 md:p-5 lg:p-6 xl:p-[30px]">
          <div className="md:flex">
            <div className="m-auto my-2 p-2 flex justify-center md:w-1/2">
              <MediaRenderer
                src={'ipfs://Qmba3umb3db7DqCA19iRSSbtzv9nYUmP8Cibo5QMkLpgpP'}
                width="100%"
                height="100%"
              />
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
                <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">{time}</p>
              </div>

              {/* Wallet Balance */}
              {address && (
                <>
                  <div>
                    <p className="opacity-70 lg:text-xl">Your Balance</p>
                    <p className="mt-1 lg:mt-2 font-semibold lg:text-lg">
                      {balance
                        ? balance.toString() +
                          (balance == 1 ? ' Ticket' : ' Tickets')
                        : '...'}
                    </p>
                  </div>

                  <div>
                    <button
                      className="p-3 bg-moon-orange lg:text-lg"
                      onClick={openViewNFTs}
                    >
                      View your NFTs
                    </button>
                    {enableViewNFTsModal && (
                      <ViewNFTDataModal
                        ttsContract={ttsContract}
                        setEnabled={setViewNFTsModal}
                      />
                    )}
                  </div>
                  {balance && +balance.toString() > 0 && (
                    <button
                      className="p-3 bg-moon-orange lg:text-lg"
                      onClick={() =>
                        window.open(
                          `https://twitter.com/intent/tweet?text=I%20entered%20to%20win%20a%20ticket%20to%20space%20through%20%0A%40OfficialMoonDAO%0A%0ASo%20awesome%20to%20know%20I%20have%20a%20chance%20to%20go%20to%20space!%20%0A%0AGet%20yours%20here%20⬇%EF%B8%8F&url=https%3A%2F%2Fapp.moondao.com%2Fsweepstakes`
                        )
                      }
                    >
                      Click to Tweet
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/*Not definitive, this one is being used on another page*/}
          <div className="mt-4 flex flex-col gap-8">
            <div className="block">
              {/* <div>
                <p className="mb-1 dark:text-white lg:text-xl">
                  Quantity to Mint
                </p>
                <div className="h-[58px] flex w-full bg-white bg-opacity-5 justify-between p-2 border-[1px] border-[#1F212B] dark:border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40">
                  <input
                    className="ml-2 w-1/3 dark:text-white bg-transparent focus:outline-none"
                    type="number"
                    step={1}
                    max={balance ? 50 - +balance : 0}
                    min={1}
                    placeholder={'1'}
                    onChange={(e: any) => {
                      if (e.target.value > 50 - balance) {
                        toast.error('Cannot mint more than 50')
                        setQuantity(50 - balance)
                      } else if (e.target.value < 1) {
                        toast.error('Mint quantity must be at least 1')
                        console.log(e.target.value)
                        setQuantity(1)
                      } else {
                        setQuantity(e.target.value)
                      }
                    }}
                    value={quantity}
                  />
                  <PrivyWeb3Button
                    className="text-white rounded-none bg-moon-orange w-[160px]"
                    label="Mint"
                    action={() => {
                      setSelectedChain(Polygon)
                      setEnableMintInfoModal(true)
                    }}
                  />
                  <PrivyWeb3Button
                    className="text-white rounded-none bg-moon-orange w-[160px] ml-1"
                    label="Mint (ETH)"
                    action={() => {
                      setSelectedChain(Ethereum)
                      setEnableEthMintInfoModal(true)
                    }}
                  />
                </div>
              </div> */}

              {enableMintInfoModal && (
                <SubmitTTSInfoModal
                  balance={balance}
                  quantity={quantity}
                  approveToken={approveToken}
                  mint={mint}
                  setEnabled={setEnableMintInfoModal}
                  ttsContract={ttsContract}
                  mooneyContract={mooneyContract}
                />
              )}

              {enableEthMintInfoModal && (
                <SubmitTTSInfoModalETH
                  quantity={quantity}
                  setEnabled={setEnableEthMintInfoModal}
                  setChain={setSelectedChain}
                  selectedChain={selectedChain}
                  mooneyContract={mooneyETHContract}
                  burn={burn}
                />
              )}
            </div>
            {/* {whitelist.includes(address || '') && canClaimFree ? (
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
            )} */}
          </div>
        </div>
      </div>

      <SweepstakesWinners ttsContract={ttsContract} supply={supply} />

      <p className="mt-4 text-sm">
        NO PURCHASE OR OBLIGATION NECESSARY TO ENTER OR WIN. PURCHASE WILL NOT
        INCREASE YOUR ODDS OF WINNING. IT IS NOT NECESSARY TO PURCHASE A TICKET
        TO SPACE NFT IN ORDER TO ENTER OR WIN. VOID WHERE PROHIBITED. THIS
        SWEEPSTAKES IS IN NO WAY SPONSORED, ENDORSED, SPONSORED OR APPROVED BY
        BLUE ORIGIN TEXAS, LLC (“BLUE ORIGIN”).
        <br></br>
        <br></br>
        THE SWEEPSTAKES IS OPEN ONLY TO INDIVIDUALS WHO ARE 18 YEARS OF AGE OR
        OLDER, OR THE AGE OF MAJORITY IF GREATER THAN 18 IN THEIR RESPECTIVE
        JURISDICTIONS. SWEEPSTAKES IS VOID IN FLORIDA, NEW YORK, PUERTO RICO AND
        WHERE OTHERWISE PROHIBITED BY LAW. RUNNER-UP PRIZE WINNERS ARE
        RESPONSIBLE FOR TAXES ASSOCIATED WITH THE RUNNER-UP PRIZES.
        <br></br>
        <br></br>
        ODDS OF WINNING DEPEND ON THE NUMBER OF ENTRIES RECEIVED DURING THE
        CONTEST PERIOD, BUT CAN BE CALCULATED BY DIVIDING THE NUMBER OF PRIZES
        BY THE TOTAL NUMBER OF ENTRIES RECEIVED. CONTEST ENDS ON JANUARY 12,
        2024. FOR ALTERNATIVE METHOD OF ENTRY,{' '}
        <a
          className="underline"
          href="https://docs.moondao.com/Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules"
        >
          CLICK HERE
        </a>
        .<br></br>
        <br></br>
        {`
          YOU MUST ENTER YOUR FULL LEGAL NAME (AS DISPLAYED ON A GOVERNMENT
          ISSUED PHOTO ID) AND THE BEST EMAIL FOR US TO CONTACT YOU IF YOU WIN A
          PRIZE IN THE SWEEPSTAKES. BY SUBMITTING YOUR INFORMATION, YOU AGREE TO
          OUR
          `}
        <a
          className="underline"
          href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
          target="_blank"
          rel="noreferrer"
        >
          {'PRIVACY POLICY'}
        </a>
        .
      </p>
    </div>
  )
}
