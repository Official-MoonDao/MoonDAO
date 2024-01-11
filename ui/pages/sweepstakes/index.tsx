import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Polygon, Ethereum, Goerli, Mumbai } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  useAddress,
  useContract,
  useContractRead,
  useOwnedNFTs,
} from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContext from '../../lib/thirdweb/chain-context'
import { useHandleRead, useHandleWrite } from '../../lib/thirdweb/hooks'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'
import { useMerkleProof } from '../../lib/utils/hooks/useMerkleProof'
import Head from '../../components/layout/Head'
import { collectionMetadata } from '../../components/marketplace/assets/seed'
import { PrivyWeb3Button } from '../../components/privy/PrivyWeb3Button'
import { SubmitTTSInfoModal } from '../../components/ticket-to-space/SubmitTTSInfoModal'
import { SubmitTTSInfoModalETH } from '../../components/ticket-to-space/SubmitTTSInfoModalETH'
import { ViewNFTDataModal } from '../../components/ticket-to-space/ViewNFTDataModal'
import ERC20 from '../../const/abis/ERC20.json'
import ttsSweepstakesV2 from '../../const/abis/ttsSweepstakesV2.json'
import { devWhitelist } from '../../const/tts/whitelist'

const TICKET_TO_SPACE_ADDRESS = '0x6434c90c9063F0Bed0800a23c75eBEdDF71b6c52' //polygon
// const TICKET_TO_SPACE_ADDRESS = '0x2b9496C22956E23CeC73299B9d3d3b7A9483D6Ff' //test address

export default function Sweepstakes() {
  const { wallets } = useWallets()
  const { user } = usePrivy()
  const [time, setTime] = useState<string>()
  const [quantity, setQuantity] = useState(1)
  const [supply, setSupply] = useState(0)
  const [enableMintInfoModal, setEnableMintInfoModal] = useState(false)
  const [enableEthMintInfoModal, setEnableEthMintInfoModal] = useState(false)
  const [enableFreeMintInfoModal, setEnableFreeMintInfoModal] = useState(false)
  const [enableViewNFTsModal, setViewNFTsModal] = useState(false)

  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const address = useAddress()

  const whitelist = devWhitelist
  const merkleProof = useMerkleProof(whitelist)
  const { contract: ttsContract } = useContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )

  const { contract: mooneyContract } = useContract(
    '0x74Ac7664ABb1C8fa152D41bb60e311a663a41C7E',
    ERC20.abi
  ) //polygon mooney

  const { contract: mooneyETHContract } = useContract(
    '0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395',
    // '0xa1fF0A4a63f067Fc79Daf4ec3a079c73F9a88E12', // sepolia testnet
    ERC20.abi
  ) //eth mooney

  const { mutateAsync: approveToken } = useTokenApproval(
    mooneyContract,
    ethers.utils.parseEther(String(20000 * quantity)),
    BigNumber.from(0),
    TICKET_TO_SPACE_ADDRESS
  )

  const { data: balance } = useContractRead(ttsContract, 'balanceOf', [address])

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

  const [nftWidth, setNftWidth] = useState(0)

  useEffect(() => {
    setNftWidth(document.getElementById('nft-container')!.offsetWidth! * 0.6)
    if (screen.availWidth < 768)
      setNftWidth(document.getElementById('nft-container')!.offsetWidth! * 0.9)
    const ts = Math.floor(1705132740 - new Date().valueOf() / 1000)
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
      <Head
        title="Ticket to Space"
        image="https://gray-main-toad-36.mypinata.cloud/ipfs/QmdTYGGb5ayHor23WeCsNeT61Qzj8JK9EQmxKWeuGTQhYq"
      />
      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
        <h1 className={`page-title`}>Ticket to Space</h1>
        {/* <h3 className="mt-5 lg:mt-8 font-bold text-center lg:text-left text-lg lg:text-xl xl:text-2xl">
          Take the leap, for the chance to win a trip to space!
        </h3> */}

        {/*Collection title, image and description*/}
        <div className="mt-6 inner-container-background relative w-full pb-3">
          {collectionMetadata && (
            <div
              className="flex flex-col bg-transparent p-4 md:p-5 lg:p-6 xl:p-[30px]"
              id="nft-container"
            >
              <div className="md:flex md:justify-between md:gap-2 xl:gap-8">
                <div className="flex justify-center border-[1px] md:border-[2px] border-[#1F212B] dark:border-white">
                  <MediaRenderer
                    src={
                      'ipfs://Qmba3umb3db7DqCA19iRSSbtzv9nYUmP8Cibo5QMkLpgpP'
                    }
                    width={nftWidth + 'px'}
                    height={nftWidth + 'px'}
                  />
                </div>
                {/*Quantity, price, expiration, balance */}
                <div className="grow flex flex-col lg:py-3 gap-2 xl:gap-6 mt-2 md:mt-0 md:text-sm md:w-1/4 border-[1px] md:border-[2px] border-[#1F212B] dark:border-white p-3 xl:px-6">
                  <div>
                    <p className="opacity-70 xl:text-xl">Total Minted</p>
                    <p className="mt-1 lg:mt-2 font-semibold xl:text-lg">
                      {supply
                        ? supply + (supply > 1 ? ' Tickets' : ' Ticket')
                        : '...loading'}
                    </p>
                  </div>

                  {/* Pricing information */}
                  <div>
                    <p className="opacity-70 xl:text-xl">Price</p>
                    <p className="mt-1 lg:mt-2 font-semibold xl:text-lg">
                      20,000 MOONEY
                    </p>
                  </div>
                  {/*Expiration*/}
                  <div>
                    <p className="opacity-70 xl:text-xl">Expiration</p>
                    <p className="mt-1 lg:mt-2 font-semibold xl:text-lg">
                      {time}
                    </p>
                  </div>

                  {/* Wallet Balance */}
                  {address && (
                    <>
                      <div>
                        <p className="opacity-70 xl:text-xl">Your Balance</p>
                        <p className="mt-1 lg:mt-2 font-semibold xl:text-lg">
                          {balance
                            ? balance.toString() +
                              (balance == 1 ? ' Ticket' : ' Tickets')
                            : '...'}
                        </p>
                      </div>

                      <div className="grow flex flex-col justify-end gap-2 xl:gap-4">
                        <button
                          className="p-3 bg-moon-orange text-xs xl:text-base"
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
                        {balance && +balance.toString() > 0 && (
                          <button
                            className="p-3 bg-moon-orange text-xs xl:text-base"
                            onClick={() =>
                              window.open(
                                `https://twitter.com/intent/tweet?text=I%20entered%20to%20win%20a%20ticket%20to%20space%20through%20%0A%40OfficialMoonDAO%0A%0ASo%20awesome%20to%20know%20I%20have%20a%20chance%20to%20go%20to%20space!%20%0A%0AGet%20yours%20here%20⬇%EF%B8%8F&url=https%3A%2F%2Fapp.moondao.com%2Fsweepstakes`
                              )
                            }
                          >
                            Share on X
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/*Not definitive, this one is being used on another page*/}
              <div className="mt-4 flex flex-col gap-8">
                <div className="block">
                  <div>
                    <p className="mb-1 dark:text-white lg:text-xl">
                      Quantity to Mint
                    </p>
                    <div
                      className={`md:h-[64px] flex flex-col md:flex-row w-full justify-left ${
                        !address && 'justify-between'
                      } gap-3 p-2 border-[1px] md:border-[2px] border-[#1F212B] dark:border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-401`}
                    >
                      <input
                        className="grow-0 md:ml-2 w-full md:w-1/5 dark:text-white bg-white bg-opacity-5 bg-transparent focus:outline-none text-center p-2"
                        type="number"
                        step={1}
                        max={balance ? 50 - +balance : 0}
                        min={0}
                        placeholder={'1'}
                        onChange={(e: any) => {
                          if (e.target.value > 50 - balance) {
                            toast.error('Cannot mint more than 50')
                            setQuantity(50 - balance)
                          } else if (e.target.value < 0) {
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
                        className="md:w-2/5 text-xs xl:text-base text-white rounded-none bg-moon-orange"
                        label="Mint"
                        action={() => {
                          setSelectedChain(Polygon)
                          setEnableMintInfoModal(true)
                        }}
                        skipNetworkCheck
                      />
                      {user && (
                        <PrivyWeb3Button
                          className="md:w-2/5 text-xs xl:text-base text-white rounded-none bg-moon-orange"
                          label="Use Ethereum Network"
                          action={() => {
                            setSelectedChain(Ethereum)
                            setEnableEthMintInfoModal(true)
                          }}
                          skipNetworkCheck
                        />
                      )}
                    </div>
                  </div>

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
          <div className="mx-5 mb-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-sm xl:text-base font-[Lato]">
            <div>
              {`One person will be randomly selected to win an opportunity on a future Blue Origin rocket to space! 
              Each NFT entry requires burning 20,000 $MOONEY. You can mint up to 50 entries.`}
            </div>
            <div className="mt-2">
              {`You can acquire $MOONEY `}
              <Link className="text-moon-gold" href="/join">
                {' using our app'}
              </Link>
              {` (`}
              <Link
                className="text-moon-gold"
                href="https://youtu.be/oQtHjbcbAio?feature=shared"
                target="_blank"
              >
                {'watch tutorial'}
              </Link>
              {'), or via '}
              <Link
                className="text-moon-gold"
                href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet"
              >
                Uniswap
              </Link>
              {`. If your $MOONEY is on the Ethereum network click "Use Ethereum Network" to enter.`}
            </div>
            <div className="mt-2">
              {`If you’re having an issue while trying to mint, you can email us at `}
              <Link
                className="text-moon-gold"
                href="mailto:support@moondao.com"
              >
                support@moondao.com
              </Link>
              {` or post in our `}
              <Link
                className="text-moon-gold"
                href="http://discord.gg/moondao"
                target="_blank"
                rel="noreferrer"
              >{`Discord's`}</Link>
              {` support channel.`}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm font-[Lato]">
          NO PURCHASE OR OBLIGATION NECESSARY TO ENTER OR WIN. PURCHASE WILL NOT
          INCREASE YOUR ODDS OF WINNING. IT IS NOT NECESSARY TO PURCHASE A
          TICKET TO SPACE NFT IN ORDER TO ENTER OR WIN. VOID WHERE PROHIBITED.
          THIS SWEEPSTAKES IS IN NO WAY SPONSORED, ENDORSED, SPONSORED OR
          APPROVED BY BLUE ORIGIN TEXAS, LLC (“BLUE ORIGIN”).
          <br></br>
          <br></br>
          THE SWEEPSTAKES IS OPEN ONLY TO INDIVIDUALS WHO ARE 18 YEARS OF AGE OR
          OLDER, OR THE AGE OF MAJORITY IF GREATER THAN 18 IN THEIR RESPECTIVE
          JURISDICTIONS. SWEEPSTAKES IS VOID IN FLORIDA, NEW YORK, PUERTO RICO
          AND WHERE OTHERWISE PROHIBITED BY LAW. RUNNER-UP PRIZE WINNERS ARE
          RESPONSIBLE FOR TAXES ASSOCIATED WITH THE RUNNER-UP PRIZES.
          <br></br>
          <br></br>
          ODDS OF WINNING DEPEND ON THE NUMBER OF ENTRIES RECEIVED DURING THE
          CONTEST PERIOD, BUT CAN BE CALCULATED BY DIVIDING THE NUMBER OF PRIZES
          BY THE TOTAL NUMBER OF ENTRIES RECEIVED. CONTEST ENDS ON JANUARY 12,
          2024. FOR ALTERNATIVE METHOD OF ENTRY,{' '}
          <a
            className="underline"
            href="https://publish.obsidian.md/moondao/MoonDAO/docs/Ticket+to+Space+NFT/Ticket+to+Space+Sweepstakes+Rules"
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
            href="https://publish.obsidian.md/moondao/MoonDAO/docs/Legal/Website+Privacy+Policy"
            target="_blank"
            rel="noreferrer"
          >
            {'PRIVACY POLICY'}
          </a>
          .
        </p>
      </div>
    </main>
  )
}
