import {
  ArrowUpRightIcon,
  ChatBubbleLeftIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Arbitrum, ArbitrumSepolia, Sepolia } from '@thirdweb-dev/chains'
import {
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useContractRead,
  useNFT,
} from '@thirdweb-dev/react'
import { ENTITY_ADDRESSES, HATS_ADDRESS, MOONEY_ADDRESSES } from 'const/config'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useEntityData } from '@/lib/entity/useEntityData'
import { useValidPass } from '@/lib/entity/useValidPass'
import { useHatTree } from '@/lib/hats/useHatTree'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { useLightMode } from '@/lib/utils/hooks'
import { CopyIcon, TwitterIcon } from '@/components/assets'
import CoordinapeLogoWhite from '@/components/assets/CoordinapeLogoWhite'
import JuiceboxLogoWhite from '@/components/assets/JuiceboxLogoWhite'
import { EntityAdminModal } from '@/components/entity/EntityAdminModal'
import { EntityMetadataModal } from '@/components/entity/EntityMetadataModal'
import { HatWearers } from '@/components/hats/HatWearers'
import Button from '@/components/subscription/Button'
import Card from '@/components/subscription/Card'
import GeneralActions from '@/components/subscription/GeneralActions'
import Proposals from '@/components/subscription/Proposals'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import MoonDAOEntityABI from '../../const/abis/MoonDAOEntity.json'

export default function EntityDetailPage({ tokenId }: any) {
  const [lightMode] = useLightMode()

  const router = useRouter()
  const address = useAddress()

  //privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  const [entityMetadataModalEnabled, setEntityMetadataModalEnabled] =
    useState(false)
  const [entitySubscriptionModalEnabled, setEntitySubscriptionModalEnabled] =
    useState(false)
  const [entityAdminModalEnabled, setEntityAdminModalEnabled] = useState(false)

  const { contract: hatsContract } = useContract(HATS_ADDRESS)
  //Entity Data
  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug],
    MoonDAOEntityABI
  )
  const { data: nft } = useNFT(entityContract, tokenId)

  const { socials, isPublic, hatTreeId, topHatId, admin, updateMetadata } =
    useEntityData(entityContract, hatsContract, nft)

  //Hats
  const hats = useHatTree(selectedChain, hatTreeId, topHatId)

  //Entity Balances
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, nft?.owner)

  const [nativeBalance, setNativeBalance] = useState<number>(0)

  async function getNativeBalance() {
    const sdk = initSDK(selectedChain)
    const provider = sdk.getProvider()
    const balance: any = await provider.getBalance(nft?.owner as string)
    setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
  }

  //Subscription Data
  const { data: expiresAt } = useContractRead(entityContract, 'expiresAt', [
    nft?.metadata?.id,
  ])

  const validPass = useValidPass(expiresAt)

  // get native balance for multisig
  useEffect(() => {
    if (wallets && nft?.owner) {
      getNativeBalance()
    }
  }, [wallets, nft])

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

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
                  {entityMetadataModalEnabled && (
                    <EntityMetadataModal
                      nft={nft}
                      selectedChain={selectedChain}
                      setEnabled={setEntityMetadataModalEnabled}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (address != nft?.owner && address != admin)
                        return toast.error(
                          'Connect the entity admin wallet or multisig to edit metadata.'
                        )
                      setEntityMetadataModalEnabled(true)
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
                {socials.communications && (
                  <Link
                    className="flex gap-2"
                    href={socials.communications}
                    target="_blank"
                    passHref
                  >
                    <ChatBubbleLeftIcon height={25} width={25} />
                    {socials.communications}
                  </Link>
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
        {address === admin || address === nft.owner ? (
          <div className="mt-8 xl:mt-0">
            {entitySubscriptionModalEnabled && (
              <SubscriptionModal
                setEnabled={setEntitySubscriptionModalEnabled}
                nft={nft}
                validPass={validPass}
                expiresAt={expiresAt}
                subscriptionContract={entityContract}
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
                    setEntitySubscriptionModalEnabled(true)
                  }}
                >
                  {'Extend Subscription'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <></>
        )}
      </Card>

      {/* Mooney and Voting Power */}
      <div className="flex flex-col xl:flex-row gap-6">
        <Card className="w-full flex flex-col md:flex-row justify-between items-start xl:items-end gap-4">
          <div className="w-3/4">
            <p className="text-2xl">Treasury</p>

            <div className="mt-4 flex gap-4 items-center text-lg">
              <p>{`MOONEY :`}</p>
              <p>
                {MOONEYBalance
                  ? (MOONEYBalance?.toString() / 10 ** 18).toLocaleString()
                  : 0}
              </p>
            </div>
            <div className="flex gap-4 items-center text-lg">
              <p>{`ETHER :`}</p>
              <p className="pl-6">{nativeBalance ? nativeBalance : 0}</p>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-2 items-end">
            <Button
              onClick={() =>
                window.open(
                  'https://app.safe.global/home?safe=eth:' + nft?.owner
                )
              }
            >
              <ArrowUpRightIcon height={20} width={20} />
              {'Manage Treasury'}
            </Button>
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
        <Proposals />
        {/* Members */}
        <Card className="w-full lg:w-1/2">
          <p className="text-2xl">Members</p>
          <div className="pb-6 h-full flex flex-col items-start justify-between">
            <div className="py-2 pr-4 flex flex-col gap-2 max-h-[150px] overflow-y-scroll">
              {hats?.map((hat: any, i: number) => (
                <HatWearers
                  key={'hat-' + i}
                  hatId={hat.id}
                  hatsContract={hatsContract}
                  wearers={hat.wearers}
                />
              ))}
            </div>
            <div className="my-2 flex flex-col xl:flex-row justify-start items-center gap-2">
              <Button
                onClick={() => {
                  window.open(
                    `https://app.hatsprotocol.xyz/trees/${selectedChain.chainId}/${hatTreeId}`
                  )
                }}
              >
                Manage Members
              </Button>
              {entityAdminModalEnabled && (
                <EntityAdminModal
                  entityContract={entityContract}
                  tokenId={nft?.metadata.id}
                  setEnabled={setEntityAdminModalEnabled}
                  adminAddress={admin}
                />
              )}
              <Button
                className=""
                onClick={() => {
                  if (address != nft?.owner && address != admin)
                    return toast.error(
                      'Connect the entity admin wallet or multisig to update the admin.'
                    )
                  setEntityAdminModalEnabled(true)
                }}
              >
                Manage Admin
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {/* General Actions */}
      <GeneralActions />
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
