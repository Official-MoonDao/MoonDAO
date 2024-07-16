// Team Profile Page
import {
  ArrowUpRightIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import {
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useContractRead,
  useSDK,
} from '@thirdweb-dev/react'
import {
  CITIZEN_ADDRESSES,
  TEAM_ADDRESSES,
  HATS_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  MOONEY_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
} from 'const/config'
import { blockedTeams } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { useSubHats } from '@/lib/hats/useSubHats'
import { useTeamData } from '@/lib/team/useTeamData'
import useEntitySplit from '@/lib/team/useTeamSplit'
import ChainContext from '@/lib/thirdweb/chain-context'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { TwitterIcon } from '@/components/assets'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Footer from '@/components/layout/Footer'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import Button from '@/components/subscription/Button'
import GeneralActions from '@/components/subscription/GeneralActions'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import TeamAction from '@/components/subscription/TeamAction'
import TeamAddHat from '@/components/subscription/TeamAddHat'
import TeamAddMember from '@/components/subscription/TeamAddMember'
import TeamDonation from '@/components/subscription/TeamDonation'
import TeamJobModal from '@/components/subscription/TeamJobModal'
import TeamJobs from '@/components/subscription/TeamJobs'
import TeamMarketplace from '@/components/subscription/TeamMarketplace'
import TeamMarketplaceListingModal from '@/components/subscription/TeamMarketplaceListingModal'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamMetadataModal from '@/components/subscription/TeamMetadataModal'
import TeamTreasury from '@/components/subscription/TeamTreasury'
import JobBoardTableABI from '../../const/abis/JobBoardTable.json'

export default function TeamDetailPage({ tokenId, nft, imageIpfsLink }: any) {
  const router = useRouter()

  const sdk = useSDK()
  const address = useAddress()

  //privy
  const { selectedChain, setSelectedChain } = useContext(ChainContext)
  const [teamMetadataModalEnabled, setTeamMetadataModalEnabled] =
    useState(false)
  const [teamSubscriptionModalEnabled, setTeamSubscriptionModalEnabled] =
    useState(false)
  const [teamJobModalEnabled, setTeamJobModalEnabled] = useState(false)
  const [teamListingModalEnabled, setTeamListingModalEnabled] = useState(false)
  const { contract: hatsContract } = useContract(HATS_ADDRESS)

  //Entity Data
  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug]
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

  const {
    socials,
    isPublic,
    isDeleted,
    hatTreeId,
    adminHatId,
    managerHatId,
    isManager,
    subIsValid,
    isLoading: isLoadingTeamData,
  } = useTeamData(teamContract, hatsContract, nft)

  const splitAddress = useEntitySplit(teamContract, tokenId)
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
    const provider = sdk?.getProvider()
    const balance: any = await provider?.getBalance(nft?.owner as string)
    setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
  }

  async function getSplitNativeBalance() {
    const provider = sdk?.getProvider()
    const balance: any = await provider?.getBalance(splitAddress as string)
    setSplitNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
  }

  //Subscription Data
  const { data: expiresAt } = useContractRead(teamContract, 'expiresAt', [
    nft?.metadata?.id,
  ])

  // get native balance for multisig
  useEffect(() => {
    if (sdk && nft?.owner) {
      getNativeBalance()
    }
    if (splitAddress) {
      getSplitNativeBalance()
    }
  }, [sdk, nft, splitAddress])

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

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
            className="bg-white rounded-[100%] w-[100px] h-[100px] absolute top-5 lg:top-[40px] left-5 lg:left-[40px]"
          ></div>
          <div
            id="frame-content"
            className="w-full flex flex-col lg:flex-row items-start justify-between"
          >
            <div
              id="profile-description-section"
              className="flex flex-col lg:flex-row items-start lg:items-center gap-4"
            >
              {nft?.metadata.image ? (
                <div
                  id="org-image-container"
                  className="relative w-full max-w-[350px] h-full md:min-w-[300px] md:min-h-[300px] md:max-w-[300px] md:max-h-[300px]"
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
              <div id="team-name-container">
                <div
                  id="team-name"
                  className="flex flex-col flex-col-reverse justify-center gap-2"
                  >
                  <div
                    id="team-name"
                    className="flex flex-row gap-2 items-center justify-start"
                    >
                    {subIsValid && isManager && (
                      <button
                        className={'absolute top-6 right-6'}
                        onClick={() => {
                          if (address === nft?.owner || isManager)
                            setTeamMetadataModalEnabled(true)
                          else
                            return toast.error(
                              'Connect the entity admin wallet or multisig to edit metadata.'
                            )
                        }}
                      >
                        <PencilIcon width={35} height={35} />
                      </button>
                    )}
                    {nft ? (
                      <h1 className="text-black opacity-[80%] order-2 lg:order-1 lg:block font-GoodTimes header dark:text-white text-3xl">
                        {nft.metadata.name}
                      </h1>
                    ) : (
                      <></>
                    )}
                  </div> 
                </div>
                <div id="profile-container"
                  >
                  {nft?.metadata.description ? (
                    <p
                      id="profile-description-container"
                      className="mb-5 w-full lg:w-[80%]"
                    >
                      {nft?.metadata.description || ''}
                    </p>
                  ) : (
                    <></>
                  )}

                  <div className="flex flex-col md:flex-row items-start justify-start lg:pr-10">
                    {socials ? (
                      <div
                        id="socials-container"
                        className="p-1.5 mb-2 md:mb-0 pl-5 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] md:rounded-[vmax] flex text-sm bg-filter"
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
                      ''
                    ) : (
                      <div id="donation-container" className="flex items-center max-w-[290px]">
                        {!isDeleted && subIsValid && (
                          <TeamDonation splitAddress={splitAddress} />
                        )}
                      </div>
                    )}
                  </div>  
                </div>
              </div>
            </div>
          </div>
        </div>
        {isManager || address === nft.owner ? (
          <div
            id="manager-container"
            className="mt-8 xl:mt-0 relative md:absolute md:top-[80px] right-0 px-5 pt-5 bg-dark-cool rounded-tl-[20px] rounded-bl-[2vmax] rounded-[20px]"
          >
            {expiresAt && (
              <div
                id="expires-container"
                className="flex flex-col gap-4 items-start"
              >
                <p className="opacity-50">
                  {'Exp: '}
                  {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                </p>
                <Frame noPadding>
                  <div id="extend-sub-button" className="gradient-2">
                    <Button
                      onClick={() => {
                        if (address === nft?.owner || isManager)
                          setTeamSubscriptionModalEnabled(true)
                        else
                          return toast.error(
                            `Connect the entity admin wallet or multisig to extend the subscription.`
                          )
                      }}
                    >
                      {'Extend Subscription'}
                    </Button>
                  </div>
                </Frame>
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
      <Head
        title={nft.metadata.name}
        description={nft.metadata.description}
        image={`https://ipfs.io/ipfs/${imageIpfsLink.split('ipfs://')[1]}`}
      />
      {teamSubscriptionModalEnabled && (
        <SubscriptionModal
          setEnabled={setTeamSubscriptionModalEnabled}
          nft={nft}
          validPass={subIsValid}
          expiresAt={expiresAt}
          subscriptionContract={teamContract}
        />
      )}
      {teamMetadataModalEnabled && (
        <TeamMetadataModal
          nft={nft}
          selectedChain={selectedChain}
          setEnabled={setTeamMetadataModalEnabled}
        />
      )}
      {teamJobModalEnabled && (
        <TeamJobModal
          teamId={tokenId}
          jobTableContract={jobTableContract}
          setEnabled={setTeamJobModalEnabled}
          refreshJobs={() => router.reload()}
        />
      )}
      {teamListingModalEnabled && (
        <TeamMarketplaceListingModal
          teamId={tokenId}
          marketplaceTableContract={marketplaceTableContract}
          setEnabled={setTeamListingModalEnabled}
          refreshListings={() => router.reload()}
        />
      )}
      <ContentLayout
        description={ProfileHeader}
        mainPadding
        mode="compact"
        popOverEffect={false}
        branded={false}
        isProfile
        preFooter={
          <NoticeFooter
            isManager={isManager}
            isCitizen={!!address && !isManager && subIsValid}
          />
        }
      >
        <div
          id="page-container"
          className="animate-fadeIn flex flex-col gap-5 w-full max-w-[1080px]"
        >
          {!isDeleted && (
            <div id="entity-actions-container" className=" z-30">
              {isManager || address === nft.owner ? (
                <div
                  id="team-actions-container"
                  className="px-5 pt-5 md:px-0 md:pt-0"
                >
                  <Frame
                    noPadding
                    marginBottom="0px"
                    bottomRight="2vmax"
                    topRight="2vmax"
                    topLeft="10px"
                    bottomLeft="2vmax"
                  >
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                      <TeamAction
                        title="Fund"
                        description="Submit a proposal to secure space project funding."
                        icon={<BanknotesIcon height={30} width={30} />}
                        onClick={() => router.push('/newProposal')}
                      />
                      <TeamAction
                        title="Hire"
                        description="List job openings or contracts to a global talent pool."
                        icon={
                          <ClipboardDocumentListIcon height={30} width={30} />
                        }
                        onClick={() => setTeamJobModalEnabled(true)}
                      />
                      <TeamAction
                        title="Sell"
                        description="List products, services, or ticketed events for sale."
                        icon={<BuildingStorefrontIcon height={30} width={30} />}
                        onClick={() => setTeamListingModalEnabled(true)}
                      />
                    </div>
                  </Frame>
                </div>
              ) : (
                ''
              )}
            </div>
          )}
          {/* Header and socials */}
          {subIsValid && !isDeleted ? (
            <div className="z-50 flex flex-col gap-5 mb-[50px]">
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
                  className="w-full md:rounded-tl-[2vmax] md:p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section"
                >
                  <div
                    id="job-title-container"
                    className="p-5 pb-0 md:p-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pr-10 "
                  >
                    <div className="flex gap-5 opacity-[50%]">
                      <Image
                        src={teamIcon}
                        alt="Job icon"
                        width={30}
                        height={30}
                      />
                      <h2 className="header font-GoodTimes">Meet the Team</h2>
                    </div>
                    {isManager && (
                      <div
                        id="button-container"
                        className="pr-5 my-2 flex flex-col md:flex-row justify-start items-center gap-2"
                      >
                        <TeamAddHat
                          multisigAddress={nft.owner}
                          adminHatId={managerHatId}
                        />
                        <TeamAddMember
                          selectedChain={selectedChain}
                          adminHatId={adminHatId}
                          multisigAddress={nft.owner}
                        />
                      </div>
                    )}
                  </div>

                  <SlidingCardMenu>
                    <div className="flex gap-4">
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
                  </SlidingCardMenu>
                </div>
              </Frame>
              {/* Jobs */}
              <TeamJobs
                teamId={tokenId}
                jobTableContract={jobTableContract}
                isManager={isManager}
              />
              <TeamMarketplace
                selectedChain={selectedChain}
                marketplaceTableContract={marketplaceTableContract}
                teamContract={teamContract}
                isManager={isManager}
                teamId={tokenId}
              />
              {/* Mooney and Voting Power */}
              {isManager && (
                <TeamTreasury
                  multisigAddress={nft.owner}
                  splitAddress={splitAddress}
                  mutlisigMooneyBalance={MOONEYBalance}
                  multisigNativeBalance={nativeBalance}
                  splitMooneyBalance={splitMOONEYBalance}
                  splitNativeBalance={splitNativeBalance}
                />
              )}
              {/* General Actions */}
              {isManager && <GeneralActions />}
            </div>
          ) : (
            // Subscription Expired
            <Frame>
              <p className="text-white">
                {isDeleted
                  ? `The profile has been deleted, please connect the owner or admin wallet to submit new data.`
                  : `The profile has expired, please connect the owner or admin wallet to renew.`}
              </p>
              {isManager && (
                <TeamTreasury
                  multisigAddress={nft.owner}
                  splitAddress={splitAddress}
                  mutlisigMooneyBalance={MOONEYBalance}
                  multisigNativeBalance={nativeBalance}
                  splitMooneyBalance={splitMOONEYBalance}
                  splitNativeBalance={splitNativeBalance}
                />
              )}
            </Frame>
          )}
        </div>
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenId: any = params?.tokenId

  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)
  const teamContract = await sdk.getContract(TEAM_ADDRESSES[chain.slug])
  const nft = await teamContract.erc721.get(tokenId)

  if (!nft || !nft.metadata.uri || blockedTeams.includes(nft.metadata.id)) {
    return {
      notFound: true,
    }
  }

  const rawMetadataRes = await fetch(nft.metadata.uri)
  const rawMetadata = await rawMetadataRes.json()
  const imageIpfsLink = rawMetadata.image

  return {
    props: {
      nft,
      tokenId,
      imageIpfsLink,
    },
  }
}
