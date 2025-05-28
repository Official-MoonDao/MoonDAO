import { BigNumber, ethers } from 'ethers'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useMerkleProof } from '../../lib/utils/hooks/useMerkleProof'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { approveToken as approve } from '@/lib/tokens/approve'
import { TICKET_TO_SPACE_ADDRESS } from '../../const/config'
import { devWhitelist } from '../../const/tts/whitelist'
import IPFSRenderer from '../layout/IPFSRenderer'
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
  const account = useActiveAccount()
  const address = account?.address

  const [time, setTime] = useState<string>()
  const [quantity, setQuantity] = useState(1)

  const [enableMintInfoModal, setEnableMintInfoModal] = useState(false)
  const [enableEthMintInfoModal, setEnableEthMintInfoModal] = useState(false)
  const [enableFreeMintInfoModal, setEnableFreeMintInfoModal] = useState(false)
  const [enableViewNFTsModal, setViewNFTsModal] = useState(false)

  const whitelist = devWhitelist
  const merkleProof = useMerkleProof(whitelist)

  const { data: supply } = useRead({
    contract: ttsContract,
    method: 'getSupply',
    params: [],
  })

  const { data: balance } = useRead({
    contract: ttsContract,
    method: 'balanceOf',
    params: [address],
  })

  async function approveToken() {
    if (!account) return
    const receipt = await approve({
      account,
      tokenContract: mooneyContract,
      spender: TICKET_TO_SPACE_ADDRESS,
      allowance: ethers.utils.parseEther(String(20000 * quantity)),
    })
    return receipt
  }

  async function mint() {
    if (!account) return
    const transaction = prepareContractCall({
      contract: ttsContract,
      method: 'mint' as string,
      params: [BigNumber.from(quantity || 0)],
    })
    const receipt = await sendAndConfirmTransaction({ transaction, account })
    return receipt
  }

  async function burn() {
    if (!account) return
    const transaction = prepareContractCall({
      contract: mooneyETHContract,
      method: 'transfer' as string,
      params: [
        '0x000000000000000000000000000000000000dead',
        ethers.utils.parseEther(String(20000 * quantity)),
      ],
    })
    const receipt = await sendAndConfirmTransaction({ transaction, account })
    return receipt
  }

  const openViewNFTs = (e: any) => {
    e.preventDefault()
    setViewNFTsModal(true)
  }

  useEffect(() => {
    const ts = Math.floor(1705132740 - new Date().valueOf() / 1000)
    if (ts > 86400) setTime('T-' + Math.floor(ts / 86400) + ' Days')
    else if (ts > 3600) setTime('T-' + Math.floor(ts / 3600) + ' Hours')
    else if (ts > 60) setTime('T-' + Math.floor(ts / 60) + ' Minutes')
    else if (ts > 0) setTime('T-' + ts + ' Seconds')
    else setTime('Expired')
  }, [])

  return (
    <>
      {/*Collection title, image and description*/}
      <div className="mt-6 inner-container-background relative w-full">
        <div className="flex flex-col bg-transparent p-4 md:p-5 lg:p-6 xl:p-[30px]">
          <div className="md:flex">
            <div className="m-auto my-2 p-2 flex justify-center md:w-1/2">
              <IPFSRenderer
                src={'ipfs://Qmba3umb3db7DqCA19iRSSbtzv9nYUmP8Cibo5QMkLpgpP'}
                width={500}
                height={500}
                alt="Ticket to Space Image"
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
    </>
  )
}
