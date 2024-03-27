import {
  ArrowUpRightIcon,
  ChatBubbleLeftIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Sepolia } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useNFT,
} from '@thirdweb-dev/react'
import {
  DISCORD_GUILD_ID,
  ENTITY_ADDRESSES,
  HATS_ADDRESS,
  MOONEY_ADDRESSES,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useProjects } from '@/lib/discord/useProjects'
import { useEntityData } from '@/lib/entity/useEntityData'
import { useValidPass } from '@/lib/entity/useValidPass'
import { useHatTree } from '@/lib/hats/useHatTree'
import { useWearer } from '@/lib/hats/useWearer'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useNewestProposals } from '@/lib/snapshot/useNewestProposals'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { CopyIcon, TwitterIcon } from '@/components/assets'
import { CoordinapeLogo } from '@/components/assets/CoordinapeLogo'
import { JuiceboxLogo } from '@/components/assets/JuiceboxLogoWhite'
import { EntityMetadataModal } from '@/components/entity/EntityMetadataModal'
import { Hat } from '@/components/hats/Hat'
import { HatWearers } from '@/components/hats/HatWearers'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'

function Card({ children, className = '', onClick }: any) {
  if (onClick)
    return (
      <button
        className={`p-4 bg-[#080C20] text-start ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    )

  return <div className={`p-4 bg-[#080C20] ${className}`}>{children}</div>
}

function Button({ children, onClick, className = '' }: any) {
  return (
    <button
      className={`w-[200px] h-[50px] px-4 py-2 text-moon-orange border-moon-orange border-2 flex items-center gap-2 hover:scale-105 duration-300 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function CitizenDetailPage({ tokenId }: any) {
  const router = useRouter()
  const address = useAddress()

  // //privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  const [subModalEnabled, setSubModalEnabled] = useState(false)

  // //Entity Data
  // const { contract: entityContract } = useContract(
  //   ENTITY_ADDRESSES[selectedChain.slug]
  // )
  // const { data: nft } = useNFT(entityContract, tokenId)

  // const {
  //   multisigAddress,
  //   socials,
  //   isPublic,
  //   hatTreeId,
  //   admin,
  //   updateMetadata,
  // } = useEntityData(entityContract, nft)

  // //Entity Balances
  // const { contract: mooneyContract } = useContract(
  //   MOONEY_ADDRESSES[selectedChain.slug]
  // )
  // const { data: MOONEYBalance } = useMOONEYBalance(
  //   mooneyContract,
  //   multisigAddress
  // )
  // const [nativeBalance, setNativeBalance] = useState<number>(0)

  // async function getNativeBalance() {
  //   const sdk = initSDK(selectedChain)
  //   const provider = sdk.getProvider()
  //   const balance: any = await provider.getBalance(multisigAddress)
  //   setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
  // }

  // //Subscription Data
  // const { data: expiresAt } = useHandleRead(entityContract, 'expiresAt', [
  //   nft?.metadata?.id || '',
  // ])
  // const validPass = useValidPass(expiresAt)

  //Proposals
  const newestProposals = useNewestProposals(3)

  // //Hats
  const hats = useWearer(selectedChain, address)
  const { contract: hatsContract } = useContract(HATS_ADDRESS)

  // // get native balance for multisig
  // useEffect(() => {
  //   if (wallets && multisigAddress) {
  //     getNativeBalance()
  //   }
  // }, [wallets, multisigAddress])

  useEffect(() => {
    setSelectedChain(Sepolia)
  }, [])

  const projects = useProjects()

  let nft: any
  let nftOwner: any

  return (
    <div className="animate-fadeIn flex flex-col gap-6 max-w-[1080px]">
      {/* Header and socials */}
      <Card>
        <div className="flex flex-col lg:flex-row md:items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {nft?.metadata.image ? (
              <ThirdwebNftMedia
                metadata={nft.metadata}
                height={'200px'}
                width={'200px'}
              />
            ) : (
              <div className="w-[200px] h-[200px] bg-[#ffffff25] animate-pulse" />
            )}
            <div>
              {nft ? (
                <h1 className="text-white text-3xl">{nft.metadata.name}</h1>
              ) : (
                <div className="w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
              )}
              {nftOwner ? (
                <button
                  className="mt-4 flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
                  onClick={() => {
                    navigator.clipboard.writeText(nftOwner)
                    toast.success('Address copied to clipboard')
                  }}
                >
                  {nftOwner?.slice(0, 6) + '...' + nftOwner?.slice(-4)}
                  <CopyIcon />
                </button>
              ) : (
                <div className="mt-4 w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
              )}
            </div>
          </div>
          {/* {subModalEnabled && (
            <SubscriptionModal
              setEnabled={setEntitySubscriptionModalEnabled}
              nft={nft}
              validPass={validPass}
              expiresAt={expiresAt}
              entityContract={entityContract}
            />
          )} */}
          {/* {expiresAt && (
            <div className="m-8 flex flex-col gap-4 items-center">
              <button
                className={`py-2 px-4 border-2 rounded-full ${
                  validPass
                    ? 'border-moon-green text-moon-green'
                    : 'border-moon-orange text-moon-orange'
                } max-w-[175px] hover:scale-105 duration-300`}
                onClick={() => {
                  if (address != multisigAddress && address != admin)
                    return toast.error(
                      'Connect the entity admin wallet or multisig to extend subscription.'
                    )
                  setSubModalEnabled(true)
                }}
              >
                {`${validPass ? '✓ Valid' : 'X Invalid'} Pass`}
              </button>
              {validPass && (
                <p className="opacity-50">
                  {'Exp: '}
                  {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                </p>
              )}
            </div>
          )} */}
        </div>

        {nft?.metadata.description ? (
          <p className="mt-4">{nft?.metadata.description || ''}</p>
        ) : (
          <div className="mt-4 w-full h-[30px] bg-[#ffffff25] animate-pulse" />
        )}
        {/* Socials */}
      </Card>

      {/* Mooney and Voting Power */}
      <div className="flex flex-col xl:flex-row gap-6">
        <Card className="w-full xl:w-1/2 flex flex-col gap-4">
          <div className="flex justify-between">
            <p>{`Total ETH`}</p>
            <p className="p-2 bg-[#ffffff25] flex gap-2">
              <Image
                src="/icons/networks/ethereum.svg"
                width={10}
                height={10}
                alt=""
              />
              {`Ethereum`}
            </p>
          </div>
          <p className="text-3xl">{0}</p>
        </Card>
        <Card className="w-full xl:w-1/2 flex flex-col">
          <div className="w-3/4">
            <p>{`Total $MOONEY`}</p>
            <p className="mt-4 text-3xl">{0}</p>
          </div>
          <div className="w-3/4">
            <p>{`Total Voting Power`}</p>
            <p className="mt-4 text-3xl">{0}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() =>
                window.open(
                  'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet'
                )
              }
            >
              <PlusCircleIcon height={30} width={30} />
              {'Get $MOONEY'}
            </Button>
            <Button onClick={() => router.push('/lock')}>
              <ArrowUpRightIcon height={20} width={20} />
              {'Stake $MOONEY'}
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Proposals */}
        <Card className="w-full lg:w-1/2">
          <p>MoonDAO Proposals</p>
          <div className="mt-2 flex flex-col gap-4">
            {newestProposals
              ? newestProposals.map((proposal: any) => (
                  <div
                    key={proposal.id}
                    className="p-2 flex justify-between bg-[#0f152f] rounded-sm"
                  >
                    <div className="flex flex-col gap-2">
                      <p>{proposal.title}</p>
                    </div>
                    <p
                      className={`${
                        proposal.state === 'closed'
                          ? 'text-moon-orange'
                          : 'text-[green]'
                      }`}
                    >
                      {proposal.state}
                    </p>
                  </div>
                ))
              : Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full h-20 bg-[#ffffff25] animate-pulse"
                  />
                ))}
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <Button>Create Proposals</Button>
            <Button>Vote on Proposals</Button>
          </div>
        </Card>
        {/* Members */}
        <Card className="w-full lg:w-1/2">
          <p>Projects</p>
          <div className="p-2 max-h-[300px] overflow-y-scroll flex flex-col gap-2">
            {projects &&
              projects.map((p: any, i: number) => (
                <Link
                  key={`project-${i}`}
                  className="flex items-center justify-between p-2 bg-[#0f152f]"
                  href={`https://discord.com/channels/${DISCORD_GUILD_ID}/${p.id}`}
                  target="_blank"
                  passHref
                >
                  <div className={'flex justify-between p-2 '}>{p.name}</div>
                  <ArrowUpRightIcon className="text-moon-orange" height={24} />
                </Link>
              ))}
          </div>
        </Card>
      </div>
      {/* General Actions */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="w-full lg:w-1/2">
          <p>Roles</p>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-scroll">
            {hats.map((hat: any) => (
              <div key={hat.id} className="py-2 bg-[#0f152f]">
                <Hat
                  selectedChain={selectedChain}
                  hatId={hat.id}
                  hatsContract={hatsContract}
                />
              </div>
            ))}
          </div>
        </Card>
        <Card className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className={'flex justify-between p-2 bg-[#0f152f]'}>
            <JuiceboxLogo />
            <ArrowUpRightIcon className="text-moon-orange" height={24} />
          </div>
          <div className={'flex justify-between p-2 bg-[#0f152f]'}>
            <CoordinapeLogo />
            <ArrowUpRightIcon className="text-moon-orange" height={24} />
          </div>
          <div className={'flex justify-between p-2 bg-[#0f152f]'}>
            <Image
              src="/logos/gitcoin-passport-logo.png"
              width={150}
              height={50}
              alt=""
            />
            <ArrowUpRightIcon className="text-moon-orange" height={24} />
          </div>
          <div className={'flex justify-between p-2 bg-[#0f152f]'}>
            <Image src="/logos/hats-logo.png" width={70} height={50} alt="" />
            <ArrowUpRightIcon className="text-moon-orange" height={24} />
          </div>
        </Card>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenId = params?.tokenId

  return {
    props: {
      tokenId,
    },
  }
}

// <p className="p-4">General Actions</p>
//         <div className="flex flex-col lg:flex-row gap-8">
//           <Card
//             className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
//             onClick={() => window.open('https://coordinape.com/')}
//           >
//             <CoordinapeLogo />
//             <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
//             <div className="mt-8 flex gap-4">
//               <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Give</p>
//               <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Rewards</p>
//             </div>
//           </Card>
//           <Card
//             className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
//             onClick={() => window.open('https://juicebox.money')}
//           >
//             <JuiceboxLogo />
//             <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
//             <div className="mt-8 flex gap-4">
//               <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
//                 Crowdfunding
//               </p>
//               <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Payout</p>
//             </div>
//           </Card>
//           <Card
//             className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
//             onClick={() => window.open('https://passport.gitcoin.co/')}
//           >
//             <Image
//               src="/logos/gitcoin-passport-logo.png"
//               width={150}
//               height={50}
//               alt=""
//             />
//             <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
//             <div className="mt-8 flex gap-4">
//               <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
//                 Reputation
//               </p>
//               <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Privacy</p>
//             </div>
//           </Card>
//         </div>
//         {/* 2nd row of general actions */}
//         <div className="mt-2 lg:mr-16 flex flex-col md:flex-row gap-8"></div>
