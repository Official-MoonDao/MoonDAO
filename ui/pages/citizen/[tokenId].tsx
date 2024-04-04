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
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useNFT,
} from '@thirdweb-dev/react'
import {
  CITIZEN_ADDRESSES,
  DISCORD_GUILD_ID,
  HATS_ADDRESS,
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useCitizenData } from '@/lib/citizen/useCitizenData'
import { useProjects } from '@/lib/discord/useProjects'
import { useValidPass } from '@/lib/entity/useValidPass'
import { useWearer } from '@/lib/hats/useWearer'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { useNewestProposals } from '@/lib/snapshot/useNewestProposals'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { useVMOONEYBalance } from '@/lib/tokens/ve-token'
import { CopyIcon, DiscordIcon, TwitterIcon } from '@/components/assets'
import CoordinapeLogoWhite from '@/components/assets/CoordinapeLogoWhite'
import JuiceboxLogoWhite from '@/components/assets/JuiceboxLogoWhite'
import { CitizenMetadataModal } from '@/components/citizen/CitizenMetadataModal'
import { Hat } from '@/components/hats/Hat'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'

function Card({ children, className = '', onClick }: any) {
  return (
    <div
      className={`p-4 rounded-md dark:bg-[#080C20] border-2 dark:border-0 text-start text-black dark:text-white ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

function Button({ children, onClick, className = '' }: any) {
  return (
    <button
      className={`w-[200px] h-[50px] px-4 py-2 text-moon-orange border-moon-orange border-[1px] flex items-center gap-2 hover:scale-105 duration-300 ${className}`}
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
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] =
    useState(false)

  //Data
  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )
  const { data: nft } = useNFT(citizenContract, tokenId)

  const { socials, isPublic } = useCitizenData(nft)

  //Balances
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, nft?.owner)
  const { contract: vMooneyContract } = useContract(
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { data: VMOONEYBalance } = useVMOONEYBalance(
    vMooneyContract,
    nft?.owner
  )

  const [nativeBalance, setNativeBalance] = useState<number>(0)

  async function getNativeBalance() {
    const sdk = initSDK(selectedChain)
    const provider = sdk.getProvider()
    const balance: any = await provider.getBalance(nft?.owner || '')
    setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
  }

  //Subscription Data
  const { data: expiresAt } = useHandleRead(citizenContract, 'expiresAt', [
    nft?.metadata?.id || '',
  ])
  const validPass = useValidPass(expiresAt)

  //Proposals
  const newestProposals = useNewestProposals(3)

  // //Hats
  const hats = useWearer(selectedChain, nft?.owner)
  const { contract: hatsContract } = useContract(HATS_ADDRESS)

  // get native balance for multisig
  useEffect(() => {
    if (nft?.owner) {
      getNativeBalance()
    }
  }, [nft])

  useEffect(() => {
    setSelectedChain(Sepolia)
  }, [])

  const projects = useProjects()

  if (!nft?.metadata) return

  return (
    <div className="animate-fadeIn flex flex-col gap-6 w-full max-w-[1080px]">
      {/* Header and socials */}
      <Card className="flex flex-col xl:flex-row justify-between dark:bg-gradient-to-tr from-[#080C20] to-[#111A46] from-60%">
        <div>
          <div className="w-full flex flex-col lg:flex-row items-start gap-8 justify-between">
            <div className="flex gap-4">
              {nft?.metadata.image ? (
                <div className="w-[125px]">
                  <ThirdwebNftMedia
                    className="rounded-full"
                    metadata={nft.metadata}
                    height={'100%'}
                    width={'100%'}
                  />
                </div>
              ) : (
                <div className="w-[200px] h-[200px] bg-[#ffffff25] animate-pulse" />
              )}
              <div>
                <div className="flex gap-4">
                  {nft ? (
                    <h1 className="text-black dark:text-white text-3xl">
                      {nft.metadata.name}
                    </h1>
                  ) : (
                    <div className="w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
                  )}
                  {citizenMetadataModalEnabled && (
                    <CitizenMetadataModal
                      nft={nft}
                      citizenContract={citizenContract}
                      setEnabled={setCitizenMetadataModalEnabled}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (address != nft?.owner)
                        return toast.error(
                          'Connect the entity admin wallet or multisig to edit metadata.'
                        )
                      setCitizenMetadataModalEnabled(true)
                    }}
                  >
                    <PencilIcon width={35} height={35} />
                  </button>
                </div>
                {nft?.owner ? (
                  <button
                    className="mt-4 flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
                    onClick={() => {
                      navigator.clipboard.writeText(nft.owner)
                      toast.success('Address copied to clipboard')
                    }}
                  >
                    {nft.owner?.slice(0, 6) + '...' + nft.owner?.slice(-4)}
                    <CopyIcon />
                  </button>
                ) : (
                  <div className="mt-4 w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
                )}
              </div>
            </div>
          </div>
          <div>
            {nft?.metadata.description ? (
              <p className="mt-4">{nft?.metadata.description || ''}</p>
            ) : (
              <div className="mt-4 w-full h-[30px] bg-[#ffffff25] animate-pulse" />
            )}
            {socials ? (
              <div className="mt-4 flex flex-col gap-2">
                {socials.discord && (
                  <button
                    className="flex gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(socials.discord)
                      toast.success('Discord username copied to clipboard.')
                    }}
                  >
                    <DiscordIcon />
                    {socials.discord}
                  </button>
                )}
                {socials.twitter && (
                  <Link
                    className="flex gap-2"
                    href={socials.twitter}
                    target="_blank"
                    passHref
                  >
                    <TwitterIcon width={25} height={25} />
                    {socials.twitter}
                  </Link>
                )}
                {socials.website && (
                  <Link
                    className="flex gap-2"
                    href={socials.website}
                    target="_blank"
                    passHref
                  >
                    <GlobeAltIcon height={25} width={25} />
                    {socials.website}
                  </Link>
                )}
              </div>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[30px] h-[30px] bg-[#ffffff25] animate-pulse rounded-full"
                />
              ))
            )}
          </div>
        </div>
        {address === nft.owner && (
          <div className="mt-8 xl:mt-0">
            {subModalEnabled && (
              <SubscriptionModal
                setEnabled={setSubModalEnabled}
                nft={nft}
                validPass={validPass}
                expiresAt={expiresAt}
                subscriptionContract={citizenContract}
              />
            )}
            {expiresAt && (
              <div className="flex flex-col gap-4 items-start">
                {validPass && (
                  <p className="opacity-50">
                    {'Exp: '}
                    {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                  </p>
                )}
                <Button
                  onClick={() => {
                    if (address != nft?.owner)
                      return toast.error(
                        `Connect the entity admin wallet or multisig to extend the subscription.`
                      )
                    setSubModalEnabled(true)
                  }}
                >
                  {'Extend Subscription'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Mooney and Voting Power */}
      <div className="flex flex-col xl:flex-row gap-6">
        <Card className="w-full flex flex-col md:flex-row gap-4  justify-between">
          <div className="flex flex-col gap-4">
            <div className="">
              <p className="text-xl">{`$MOONEY`}</p>
              <p className="text-3xl">
                {(MOONEYBalance?.toString() / 10 ** 18).toLocaleString() || 0}
              </p>
            </div>
            <div className="">
              <p className="text-xl">{`Voting Power`}</p>
              <p className="text-2xl">
                {(VMOONEYBalance?.toString() / 10 ** 18).toLocaleString() || 0}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
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

      <div className="flex flex-col 2xl:flex-row gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Proposals */}
            <Card className="w-full flex flex-col justify-between">
              <p className="text-2xl">Governance</p>
              <div className="mt-2 flex flex-col gap-4">
                {newestProposals
                  ? newestProposals.map((proposal: any) => (
                      <div
                        key={proposal.id}
                        className="p-2 flex justify-between border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                      >
                        <div className="flex flex-col gap-2">
                          <p>{proposal.title}</p>
                        </div>
                        <p
                          className={`flex items-center justify-center px-2 h-8 w-24 rounded-full bg-opacity-25 ${
                            proposal.state === 'closed'
                              ? 'text-moon-orange bg-red-400'
                              : 'text-moon-green bg-moon-green'
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
                <Button
                  onClick={() =>
                    window.open(
                      'https://discord.com/channels/914720248140279868/1027658256706961509'
                    )
                  }
                >
                  Create Proposals
                </Button>
                <Button
                  onClick={() =>
                    window.open('https://snapshot.org/#/tomoondao.eth')
                  }
                >
                  Vote on Proposals
                </Button>
              </div>
            </Card>
          </div>

          <Card className="w-full">
            <p className="text-2xl">Roles</p>
            <div className="py-4 flex flex-col gap-2 max-h-[300px] overflow-y-scroll">
              {hats.map((hat: any) => (
                <div
                  key={hat.id}
                  className="py-2 border-2 dark:border-0 dark:bg-[#0f152f]"
                >
                  <Hat
                    selectedChain={selectedChain}
                    hatId={hat.id}
                    hatsContract={hatsContract}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
        {/* Projects */}
        <Card className="w-full 2xl:w-1/2">
          <p className="text-2xl">Projects</p>
          <div className="py-4 max-h-[600px] overflow-y-scroll flex flex-col gap-2">
            {projects &&
              projects.map((p: any, i: number) => (
                <Link
                  key={`project-${i}`}
                  className="flex items-center justify-between p-2 border-2 dark:border-0 dark:bg-[#0f152f]"
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
        {/* General Actions */}
      </div>
      <div className="flex flex-col gap-4">
        <p className="p-4 text-2xl">General Actions</p>
        <div className="flex flex-col lg:flex-row gap-8">
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300 bg-[#e7e5e7]"
            onClick={() => window.open('https://coordinape.com/')}
          >
            <CoordinapeLogoWhite />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Give</p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Rewards</p>
            </div>
          </Card>
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300 bg-[#e7e5e7]"
            onClick={() => window.open('https://juicebox.money')}
          >
            <JuiceboxLogoWhite />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
                Crowdfunding
              </p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Payout</p>
            </div>
          </Card>
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300 bg-[#e7e5e7]"
            onClick={() => window.open('https://passport.gitcoin.co/')}
          >
            <Image
              src="/logos/gitcoin-passport-logo.png"
              width={150}
              height={50}
              alt=""
            />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
                Reputation
              </p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Privacy</p>
            </div>
          </Card>
        </div>
        {/* 2nd row of general actions */}
        <div className="mt-2 lg:mr-16 flex flex-col md:flex-row gap-8"></div>
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
