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
import Safe, { SafeConfig } from '@safe-global/protocol-kit'
import CitizenABI from 'const/abis/Citizen.json'
import HatsABI from 'const/abis/Hats.json'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import JobBoardTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import MissionTableABI from 'const/abis/MissionTable.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  TEAM_ADDRESSES,
  HATS_ADDRESS,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  TEAM_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_TOKENS_ADDRESS,
  MISSION_TABLE_ADDRESSES,
  JBV5_DIRECTORY_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
} from 'const/config'
import { blockedTeams } from 'const/whitelist'
import { ethers } from 'ethers'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount, useWalletBalance } from 'thirdweb/react'
import { privateKeyToAccount } from 'thirdweb/wallets'
import CitizenContext from '@/lib/citizen/citizen-context'
import { useSubHats } from '@/lib/hats/useSubHats'
import useSafe from '@/lib/safe/useSafe'
import { generatePrettyLinks } from '@/lib/subscription/pretty-links'
import { teamRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client, { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { serialize } from '@/lib/utils/serialize'
import { TwitterIcon } from '@/components/assets'
import Address from '@/components/layout/Address'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import StandardButton from '@/components/layout/StandardButton'
import SafeModal from '@/components/safe/SafeModal'
import Action from '@/components/subscription/Action'
import GeneralActions from '@/components/subscription/GeneralActions'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import TeamDonation from '@/components/subscription/TeamDonation'
import TeamJobModal from '@/components/subscription/TeamJobModal'
import TeamJobs from '@/components/subscription/TeamJobs'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMarketplace from '@/components/subscription/TeamMarketplace'
import TeamMarketplaceListingModal from '@/components/subscription/TeamMarketplaceListingModal'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamMetadataModal from '@/components/subscription/TeamMetadataModal'
import TeamMissions from '@/components/subscription/TeamMissions'
import TeamTreasury from '@/components/subscription/TeamTreasury'

export default function TeamDetailPage({
  tokenId,
  nft,
  imageIpfsLink,
  queriedJob,
  queriedListing,
  safeOwners,
}: any) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  //privy
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { citizen } = useContext(CitizenContext)
  const [teamMetadataModalEnabled, setTeamMetadataModalEnabled] =
    useState(false)
  const [teamSubscriptionModalEnabled, setTeamSubscriptionModalEnabled] =
    useState(false)
  const [teamJobModalEnabled, setTeamJobModalEnabled] = useState(false)
  const [teamListingModalEnabled, setTeamListingModalEnabled] = useState(false)

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    abi: HatsABI,
    chain: selectedChain,
  })

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
    chain: selectedChain,
  })

  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI,
    chain: selectedChain,
  })

  const jobTableContract = useContract({
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    abi: JobTableABI,
    chain: selectedChain,
  })

  const marketplaceTableContract = useContract({
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    abi: MarketplaceTableABI,
    chain: selectedChain,
  })

  const missionTableContract = useContract({
    address: MISSION_TABLE_ADDRESSES[chainSlug],
    abi: MissionTableABI,
    chain: selectedChain,
  })

  const missionCreatorContract = useContract({
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreator.abi,
    chain: selectedChain,
  })

  const jbControllerContract = useContract({
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi,
    chain: selectedChain,
  })

  const jbDirectoryContract = useContract({
    address: JBV5_DIRECTORY_ADDRESS,
    abi: JBV5Directory.abi,
    chain: selectedChain,
  })

  const jbTokensContract = useContract({
    address: JBV5_TOKENS_ADDRESS,
    abi: JBV5Tokens.abi,
    chain: selectedChain,
  })

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

  const hats = useSubHats(selectedChain, adminHatId, true)

  const safeData = useSafe(nft?.owner)

  const isSigner = safeOwners.includes(address || '')

  //Subscription Data
  const { data: expiresAt } = useRead({
    contract: teamContract,
    method: 'expiresAt',
    params: [tokenId],
  })

  useChainDefault()

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
                  <IPFSRenderer
                    alt="Team Image"
                    className="rounded-full"
                    src={nft.metadata.image}
                    height={300}
                    width={300}
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
                      <h1 className="max-w-[450px] text-black opacity-[80%] order-2 lg:order-1 lg:block font-GoodTimes header dark:text-white text-3xl">
                        {nft.metadata.name}
                      </h1>
                    ) : (
                      <></>
                    )}
                  </div>
                </div>
                <div id="profile-container">
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
                        className="p-1.5 mb-2 mr-2 md:mb-0 px-5 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] md:rounded-[vmax] flex text-sm bg-filter"
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
                      <div
                        id="donation-container"
                        className="flex items-center max-w-[290px]"
                      >
                        {!isDeleted && subIsValid && (
                          <TeamDonation recipient={nft?.owner} />
                        )}
                      </div>
                    )}

                    {/*Subscription Extension Container*/}
                    {isManager || address === nft.owner ? (
                      <div id="manager-container" className="relative">
                        {expiresAt && (
                          <div id="expires-container" className="">
                            <div
                              id="extend-sub-button-container"
                              className="overflow-hidden text-sm"
                            >
                              <div
                                id="extend-sub-button"
                                className="gradient-2 rounded-[2vmax] rounded-tl-[10px] md:rounded-tl-[2vmax] md:rounded-bl-[10px]"
                              >
                                <StandardButton
                                  onClick={() => {
                                    setTeamSubscriptionModalEnabled(true)
                                  }}
                                >
                                  {'Extend Plan'}
                                </StandardButton>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <></>
                    )}
                  </div>
                  {isManager || address === nft.owner ? (
                    <p className="opacity-50 mt-2 text-sm">
                      {'Exp: '}
                      {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                    </p>
                  ) : (
                    <></>
                  )}
                  <div className="mt-4">
                    <Address address={nft.owner} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Frame>
    </div>
  )

  const teamIcon = '/./assets/icon-team.svg'

  return (
    <Container>
      <Head
        title={nft.metadata.name}
        secondaryTitle={queriedListing?.title || queriedJob?.title}
        description={
          queriedListing?.description ||
          queriedJob?.description ||
          nft.metadata.description
        }
        image={`https://ipfs.io/ipfs/${
          queriedListing
            ? queriedListing.image.split('ipfs://')[1]
            : imageIpfsLink.split('ipfs://')[1]
        }`}
      />

      {teamSubscriptionModalEnabled && (
        <SubscriptionModal
          selectedChain={selectedChain}
          setEnabled={setTeamSubscriptionModalEnabled}
          nft={nft}
          validPass={subIsValid}
          expiresAt={expiresAt}
          subscriptionContract={teamContract}
          type="team"
        />
      )}
      {teamMetadataModalEnabled && (
        <TeamMetadataModal
          account={account}
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
        preFooter={<NoticeFooter darkBackground={true} />}
      >
        <div
          id="page-container"
          className="animate-fadeIn flex flex-col gap-5 w-full max-w-[1080px]"
        >
          {!isDeleted && subIsValid && (
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
                    <div className="mt-2 px-2 grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
                      <Action
                        title="Fund"
                        description="Launch a mission to raise funds."
                        icon={<BanknotesIcon height={30} width={30} />}
                        onClick={() => router.push('/launch?status=create')}
                      />
                      <Action
                        title="Hire"
                        description="List job openings or contracts to a global talent pool."
                        icon={
                          <ClipboardDocumentListIcon height={30} width={30} />
                        }
                        onClick={() => setTeamJobModalEnabled(true)}
                      />
                      <Action
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

          {subIsValid && (
            <TeamTreasury
              isSigner={isSigner}
              safeData={safeData}
              multisigAddress={nft.owner}
              safeOwners={safeOwners}
            />
          )}

          {/* Header and socials */}
          {subIsValid && (
            <TeamMissions
              selectedChain={selectedChain}
              isManager={isManager}
              teamId={tokenId}
              missionTableContract={missionTableContract}
              missionCreatorContract={missionCreatorContract}
              jbControllerContract={jbControllerContract}
              jbDirectoryContract={jbDirectoryContract}
              jbTokensContract={jbTokensContract}
              teamContract={teamContract}
            />
          )}
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
                    className="p-5 pb-0 md:p-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pr-12 "
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
                    {isManager && hats?.[0]?.id && (
                      <div
                        id="button-container"
                        className="pr-12 my-2 flex flex-col md:flex-row justify-start items-center gap-2"
                      >
                        {/* <StandardButton
                          className="min-w-[200px] gradient-2 rounded-[5vmax]"
                          onClick={() => {
                            window.open(
                              `https://app.hatsprotocol.xyz/trees/${selectedChain.chainId}/${hatTreeId}`
                            )
                          }}
                        >
                          Manage Members
                        </StandardButton> */}
                        <TeamManageMembers
                          account={account}
                          hats={hats}
                          hatsContract={hatsContract}
                          teamContract={teamContract}
                          teamId={tokenId}
                          selectedChain={selectedChain}
                          multisigAddress={nft.owner}
                          adminHatId={adminHatId}
                          managerHatId={managerHatId}
                        />
                      </div>
                    )}
                  </div>

                  <SlidingCardMenu>
                    <div className="flex gap-4">
                      {hats?.[0].id && (
                        <TeamMembers
                          hats={hats}
                          hatsContract={hatsContract}
                          citizenContract={citizenContract}
                        />
                      )}
                    </div>
                  </SlidingCardMenu>
                </div>
              </Frame>
              <TeamJobs
                teamId={tokenId}
                jobTableContract={jobTableContract}
                isManager={isManager}
                isCitizen={citizen}
              />
              <TeamMarketplace
                selectedChain={selectedChain}
                marketplaceTableContract={marketplaceTableContract}
                teamContract={teamContract}
                isManager={isManager}
                teamId={tokenId}
                isCitizen={citizen}
              />
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

              <TeamTreasury
                isSigner={isSigner}
                safeData={safeData}
                multisigAddress={nft.owner}
                safeOwners={safeOwners}
              />
            </Frame>
          )}
        </div>
      </ContentLayout>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async ({
  params,
  query,
}) => {
  const tokenIdOrName: any = params?.tokenIdOrName

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const teamTableStatement = `SELECT * FROM ${TEAM_TABLE_NAMES[chainSlug]}`
  const allTeams = (await queryTable(chain, teamTableStatement)) as any
  const { prettyLinks } = generatePrettyLinks(allTeams)

  let tokenId
  if (!Number.isNaN(Number(tokenIdOrName))) {
    tokenId = tokenIdOrName
  } else {
    tokenId = prettyLinks[tokenIdOrName]
  }

  if (tokenId === undefined) {
    return {
      notFound: true,
    }
  }

  const teamContract = getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: chain,
  })

  const owner = await readContract({
    contract: teamContract,
    method: 'ownerOf',
    params: [tokenId],
  })

  const nft = teamRowToNFT(allTeams.find((team: any) => +team.id === +tokenId))
  nft.owner = owner

  if (!nft || blockedTeams.includes(Number(nft.metadata.id))) {
    return {
      notFound: true,
    }
  }

  const rpcUrl = getRpcUrlForChain({
    client: serverClient,
    chain: DEFAULT_CHAIN_V5,
  })

  const teamSafe = await Safe.init({
    provider: rpcUrl,
    safeAddress: nft.owner,
  })

  const safeOwners = await teamSafe.getOwners()

  const imageIpfsLink = nft.metadata.image

  //Check for a jobId in the url and get the queried job if it exists
  const jobId = query?.job
  let queriedJob = null
  if (jobId !== undefined) {
    const jobTableContract = getContract({
      client: serverClient,
      address: JOBS_TABLE_ADDRESSES[chainSlug],
      abi: JobBoardTableABI as any,
      chain: chain,
    })
    const jobTableName = await readContract({
      contract: jobTableContract,
      method: 'getTableName' as string,
      params: [],
    })
    const jobTableStatement = `SELECT * FROM ${jobTableName} WHERE id = ${jobId}`

    const jobData = await queryTable(chain, jobTableStatement)
    queriedJob = jobData?.[0] || null
  }

  //Check for a listingId in the url and get the queried listing if it exists
  const listingId = query?.listing
  let queriedListing = null
  if (listingId !== undefined) {
    const marketplaceTableContract = getContract({
      client: serverClient,
      address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
      abi: MarketplaceTableABI as any,
      chain: chain,
    })
    const marketplaceTableName = await readContract({
      contract: marketplaceTableContract,
      method: 'getTableName' as string,
      params: [],
    })
    const marketplaceTableStatement = `SELECT * FROM ${marketplaceTableName} WHERE id = ${listingId}`

    const marketplaceData = await queryTable(chain, marketplaceTableStatement)
    queriedListing = marketplaceData?.[0] || null
  }

  return {
    props: {
      nft: {
        ...nft,
        id: tokenId,
        metadata: {
          ...nft.metadata,
          id: tokenId,
        },
      },
      tokenId,
      imageIpfsLink,
      queriedJob,
      queriedListing,
      safeOwners,
    },
  }
}
