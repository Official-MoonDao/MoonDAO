// Team Profile Page
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
  useSDK,
} from '@thirdweb-dev/react'
import {
  CITIZEN_ADDRESSES,
  ENTITY_ADDRESSES,
  HATS_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  MOONEY_ADDRESSES,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { useEntityData } from '@/lib/entity/useEntityData'
import useEntitySplit from '@/lib/entity/useEntitySplit'
import { useHatTree } from '@/lib/hats/useHatTree'
import { useSubHats } from '@/lib/hats/useSubHats'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContext from '@/lib/thirdweb/chain-context'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { useLightMode } from '@/lib/utils/hooks'
import { CopyIcon, TwitterIcon } from '@/components/assets'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import InnerPreFooter from '@/components/layout/InnerPreFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import Button from '@/components/subscription/Button'
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

  const { contract: marketplaceTableContract } = useContract(
    MARKETPLACE_TABLE_ADDRESSES[selectedChain.slug]
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

  const splitAddress = useEntitySplit(entityContract, tokenId)
  //Hats
  const hats = useSubHats(selectedChain, adminHatId)

  //Entity Balances
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, nft?.owner)

  const { data: splitMOONEYBalance } = useMOONEYBalance(
    mooneyContract,
    splitAddress
  )

  const [splitNativeBalance, setSplitNativeBalance] = useState<number>(0)
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

  // Horizontal scroll effect
  const teamMembersContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = (event: WheelEvent) => {
      if (teamMembersContainerRef.current) {
        event.preventDefault()
        teamMembersContainerRef.current.scrollLeft += event.deltaY
      }
    }

    const container = teamMembersContainerRef.current
    if (container) {
      container.addEventListener('wheel', handleScroll, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleScroll)
      }
    }
  }, [])

  if (!nft?.metadata || isLoadingEntityData) return null

  //Profile Header Section
  const ProfileHeader = (
    <div id="orgheader-container">
      <Frame
        noPadding
        bottomRight="0px"
        bottomLeft="0px"
        topLeft="0px"
        topRight="0px"
        className="z-50"
        marginBottom="0px"
      >
        <div id="frame-content-container" className="w-full">
          <div
            id="moon-asset-container"
            className="bg-white rounded-[100%] w-[100px] h-[100px] absolute top-5 lg:top-[40px]left-5 lg:left-[40px]"
          ></div>
          <div
            id="frame-content"
            className="w-full flex flex-col lg:flex-row items-start justify-between"
          >
            <div
              id="profile-description-section"
              className="flex flex-col lg:flex-row items-start lg:items-end gap-4"
            >
              {nft?.metadata.image ? (
                <div
                  id="org-image-container"
                  className="relative w-[300px] h-[300px]"
                >
                  <ThirdwebNftMedia
                    className="rounded-full"
                    metadata={nft.metadata}
                    height={'300'}
                    width={'300'}
                  />
                  <div
                    id="star-asset-container"
                    className="absolute bottom-0 lg:right-0"
                  >
                    <Image
                      src="/../.././assets/icon-star.svg"
                      alt=""
                      width={80}
                      height={80}
                    ></Image>
                  </div>
                </div>
              ) : (
                <></>
              )}
              <div id="entity-name-container">
                <div
                  id="entity-name"
                  className="flex flex-col justify-center  gap-4"
                >
                  {nft ? (
                    <h1 className="text-black opacity-[80%] order-2 lg:order-1 lg:block font-GoodTimes header dark:text-white text-3xl">
                      {nft.metadata.name}
                    </h1>
                  ) : (
                    <></>
                  )}

                  {socials ? (
                    <div
                      id="socials-container"
                      className="pl-5 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] md:rounded-[vmax] flex text-sm bg-filter p-2"
                    >
                      {socials.communications && (
                        <Link
                          className="flex gap-2"
                          href={socials.communications}
                          target="_blank"
                          passHref
                        >
                          <ChatBubbleLeftIcon height={25} width={25} />
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
                        </Link>
                      )}
                    </div>
                  ) : (
                    <></>
                  )}
                  {isManager || address === nft.owner ? (
                    <EntityActions
                      entityId={tokenId}
                      jobTableContract={jobTableContract}
                      marketplaceTableContract={marketplaceTableContract}
                    />
                  ) : (
                    <div className="max-w-[290px]">
                      <EntityDonation splitAddress={splitAddress} />
                    </div>
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
          <div id="profile-container">
            {nft?.metadata.description ? (
              <p
                id="profile-description-container"
                className="mt-4 w-full lg:w-[80%]"
              >
                {nft?.metadata.description || ''}
              </p>
            ) : (
              <></>
            )}
          </div>
        </div>

        {isManager || address === nft.owner ? (
          <div id="manager-container" className="mt-8 xl:mt-0">
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
              <div
                id="expires-container"
                className="flex flex-col gap-4 items-start"
              >
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
      </Frame>
    </div>
  )

  const teamIcon = '/./assets/icon-team.svg'

  return (
    <Container>
      <ContentLayout
        description={ProfileHeader}
        preFooter={<InnerPreFooter />}
        mainPadding
        mode="compact"
        popOverEffect={false}
        branded={false}
        isProfile
      >
        <div
          id="page-container"
          className="animate-fadeIn flex flex-col gap-5 w-full max-w-[1080px]"
        >
          {/* Header and socials */}
          {subIsValid ? (
            <div className="z-50 flex flex-col gap-6">
              {/* Team Actions */}
              {/* Team */}
              <Frame
                noPadding
                bottomLeft="0px"
                bottomRight="0px"
                topRight="0px"
                topLeft="0px"
              >
                <div
                  id="team-container"
                  className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section"
                >
                  <div
                    id="job-title-container"
                    className="flex gap-5 items-center opacity-[50%]"
                  >
                    <Image
                      src={teamIcon}
                      alt="Job icon"
                      width={30}
                      height={30}
                    />
                    <h2 className="header font-GoodTimes">Meet Our Team</h2>
                  </div>
                  <SlidingCardMenu>
                    <div className="pb-5 h-full flex flex-col items-start justify-between">
                      <div
                        id="team-members-container"
                        ref={teamMembersContainerRef}
                        className="flex w-full gap-2 overflow-auto"
                      >
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
                  </SlidingCardMenu>
                </div>
              </Frame>
              {/* Jobs */}
              <EntityJobs
                entityId={tokenId}
                jobTableContract={jobTableContract}
                isManager={isManager}
              />
              <EntityMarketplace
                selectedChain={selectedChain}
                marketplaceTableContract={marketplaceTableContract}
                entityContract={entityContract}
                isManager={isManager}
                entityId={tokenId}
              />
              {/* Mooney and Voting Power */}
              <div
                id="mooney-voting-power-container"
                className="flex flex-col xl:flex-row gap-6"
              >
                <Frame>
                  <div className="w-3/4">
                    <div className="flex items-center gap-4">
                      <p className="text-2xl">Treasury</p>
                      {nft?.owner ? (
                        <button
                          className="flex items-center gap-2 text-white font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
                          onClick={() => {
                            navigator.clipboard.writeText(nft.owner)
                            toast.success('Address copied to clipboard')
                          }}
                        >
                          {nft.owner?.slice(0, 6) +
                            '...' +
                            nft.owner?.slice(-4)}
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
                          ? (
                              MOONEYBalance?.toString() /
                              10 ** 18
                            ).toLocaleString()
                          : 0}
                      </p>
                    </div>
                    <div className="flex gap-4 items-center text-lg">
                      <p>{`ETHER :`}</p>
                      <p className="pl-6">
                        {nativeBalance ? nativeBalance : 0}
                      </p>
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
                </Frame>
              </div>

              {/* General Actions */}
              {isManager && <GeneralActions />}
            </div>
          ) : (
            // Subscription Expired
            <Frame>
              <p className="text-white">
                {`The pass has expired, please connect the owner or admin wallet to renew.`}
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
            </Frame>
          )}
        </div>
      </ContentLayout>
    </Container>
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
