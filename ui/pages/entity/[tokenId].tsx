import {
  ArrowUpRightIcon,
  ChatBubbleLeftIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import {
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useContractRead,
  useNFT,
} from '@thirdweb-dev/react'
import {
  CITIZEN_ADDRESSES,
  ENTITY_ADDRESSES,
  HATS_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  MOONEY_ADDRESSES,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useEntityData } from '@/lib/entity/useEntityData'
import { useHatTree } from '@/lib/hats/useHatTree'
import { useSubHats } from '@/lib/hats/useSubHats'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContext from '@/lib/thirdweb/chain-context'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { useLightMode } from '@/lib/utils/hooks'
import { CopyIcon, TwitterIcon } from '@/components/assets'
import Button from '@/components/subscription/Button'
import Card from '@/components/subscription/Card'
import EntityActions from '@/components/subscription/EntityActions'
import EntityDonation from '@/components/subscription/EntityDonation'
import EntityJobs from '@/components/subscription/EntityJobs'
import EntityMarketplace from '@/components/subscription/EntityMarketplace'
import { EntityMetadataModal } from '@/components/subscription/EntityMetadataModal'
import GeneralActions from '@/components/subscription/GeneralActions'
import Proposals from '@/components/subscription/Proposals'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import TeamMembers from '@/components/subscription/TeamMembers'
import JobBoardTableABI from '../../const/abis/JobBoardTable.json'

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

  const { contract: hatsContract } = useContract(HATS_ADDRESS)
  //Entity Data
  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  const { contract: citizenConract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )

  const { contract: jobTableContract } = useContract(
    JOBS_TABLE_ADDRESSES[selectedChain.slug],
    JobBoardTableABI
  )

  const { data: nft } = useNFT(entityContract, tokenId)

  const {
    socials,
    isPublic,
    hatTreeId,
    adminHatId,
    isManager,
    subIsValid,
    isLoading: isLoadingEntityData,
  } = useEntityData(entityContract, hatsContract, nft)

  //Hats
  const hats = useSubHats(selectedChain, adminHatId)

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

  if (!nft?.metadata || isLoadingEntityData) return

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
                  {subIsValid && isManager && (
                    <button
                      onClick={() => {
                        if (address === nft?.owner || isManager)
                          setEntityMetadataModalEnabled(true)
                        else
                          return toast.error(
                            'Connect the entity admin wallet or multisig to edit metadata.'
                          )
                      }}
                    >
                      <PencilIcon width={35} height={35} />
                    </button>
                  )}
                </div>
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
              <div className="mt-4 inline-flex flex-col gap-2">
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
                    <TwitterIcon />
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
              <div className="mt-4 w-[200px] h-[30px] bg-[#ffffff25] animate-pulse" />
            )}
          </div>
        </div>
        {isManager || address === nft.owner ? (
          <div className="mt-8 xl:mt-0">
            {entitySubscriptionModalEnabled && (
              <SubscriptionModal
                setEnabled={setEntitySubscriptionModalEnabled}
                nft={nft}
                validPass={subIsValid}
                expiresAt={expiresAt}
                subscriptionContract={entityContract}
              />
            )}
            {expiresAt && (
              <div className="flex flex-col gap-4 items-start">
                <p className="opacity-50">
                  {'Exp: '}
                  {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                </p>

                <Button
                  onClick={() => {
                    if (address === nft?.owner || isManager)
                      setEntitySubscriptionModalEnabled(true)
                    else
                      return toast.error(
                        `Connect the entity admin wallet or multisig to extend the subscription.`
                      )
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

      {subIsValid ? (
        <div className="flex flex-col gap-6">
          {/* Team Actions */}

          {isManager || address === nft.owner ? (
            <EntityActions
              entityId={tokenId}
              jobTableContract={jobTableContract}
            />
          ) : (
            <EntityDonation multisigAddress={nft.owner} />
          )}

          {/* Team */}
          <Card className="w-full">
            <p className="text-2xl">Team</p>
            <div className="pb-6 h-full flex flex-col items-start justify-between">
              <div className="w-full py-2 pr-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 h-[800px] overflow-auto">
                {hats?.map((hat: any, i: number) => (
                  <TeamMembers
                    key={'hat-' + i}
                    selectedChain={selectedChain}
                    hatId={hat.id}
                    hatsContract={hatsContract}
                    citizenConract={citizenConract}
                    wearers={hat.wearers}
                  />
                ))}
              </div>
              {isManager && (
                <div className="my-2 flex flex-col md:flex-row justify-start items-center gap-2">
                  <Button
                    onClick={() => {
                      window.open(
                        `https://app.hatsprotocol.xyz/trees/${selectedChain.chainId}/${hatTreeId}`
                      )
                    }}
                  >
                    Manage Members
                  </Button>
                </div>
              )}
            </div>
          </Card>
          {/* Jobs */}
          <EntityJobs
            entityId={tokenId}
            jobTableContract={jobTableContract}
            isManager={isManager}
          />

          <EntityMarketplace selectedChain={selectedChain} entityId={tokenId} />
          {/* Mooney and Voting Power */}
          <div className="flex flex-col xl:flex-row gap-6">
            <Card className="w-full flex flex-col md:flex-row justify-between items-start xl:items-end gap-4">
              <div className="w-3/4">
                <div className="flex items-center gap-4">
                  <p className="text-2xl">Treasury</p>
                  {nft?.owner ? (
                    <button
                      className="flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
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

              <div className="flex flex-col 2xl:flex-row gap-2 items-end">
                <Button
                  onClick={() => {
                    const safeNetwork =
                      process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                        ? 'arb1'
                        : 'sep'
                    window.open(
                      `https://app.safe.global/home?safe=${safeNetwork}:${nft?.owner}`
                    )
                  }}
                >
                  <ArrowUpRightIcon height={20} width={20} />
                  {'Treasury'}
                </Button>
              </div>
            </Card>
          </div>

          {/* General Actions */}
          {isManager && <GeneralActions />}
        </div>
      ) : (
        // Subscription Expired
        <Card>
          <p className="text-moon-orange">
            {`The pass has expired, please connect the owner or admin wallet to
            renew.`}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              const safeNetwork =
                process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
              window.open(
                `https://app.safe.global/home?safe=${safeNetwork}:${nft?.owner}`
              )
            }}
          >
            <ArrowUpRightIcon height={20} width={20} />
            {'Treasury'}
          </Button>
        </Card>
      )}
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
