// Team Profile Page
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  PencilIcon,
  UserGroupIcon,
  BriefcaseIcon,
  ShoppingBagIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import Safe from '@safe-global/protocol-kit'
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
import { BLOCKED_TEAMS } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract } from 'thirdweb'
import { getRpcUrlForChain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import useSafe from '@/lib/safe/useSafe'
import { generatePrettyLinks } from '@/lib/subscription/pretty-links'
import { teamRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { useTeamData } from '@/lib/team/useTeamData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { TwitterIcon } from '@/components/assets'
import DashboardCard from '@/components/dashboard/DashboardCard'
import StatsCard from '@/components/dashboard/StatsCard'
import Address from '@/components/layout/Address'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import Action from '@/components/subscription/Action'
import GeneralActions from '@/components/subscription/GeneralActions'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
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
    hasFullAccess,
    jobs,
    listings,
    missions,
    isLoadingActivityData,
  } = useTeamData(teamContract, hatsContract, nft, citizen, {
    teamId: tokenId,
    selectedChain,
    jobTableContract,
    marketplaceTableContract,
    missionTableContract,
    jbControllerContract,
  })

  const hats = useSubHats(selectedChain, adminHatId, true)
  const wearers = useUniqueHatWearers(hats)

  const safeData = useSafe(nft?.owner)

  const isSigner = safeOwners.includes(address || '')

  //Subscription Data
  const { data: expiresAt } = useRead({
    contract: teamContract,
    method: 'expiresAt',
    params: [tokenId],
  })

  // Calculate stats from fetched data
  const teamStats = {
    memberCount: wearers?.length || 0,
    jobCount: jobs?.length || 0,
    listingCount: listings?.length || 0,
    missionCount: missions?.length || 0,
    treasuryBalance: '0',
  }

  useChainDefault()

  //Profile Header Section
  const ProfileHeader = (
    <div id="teamheader-container" className="w-full">
      <div className="w-full bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 overflow-hidden">
        <div id="frame-content-container" className="w-full p-6 lg:p-8">
          <div
            id="frame-content"
            className="w-full flex flex-col lg:flex-row items-start justify-between gap-6"
          >
            <div
              id="profile-description-section"
              className="flex w-full flex-col lg:flex-row items-stretch gap-6"
            >
              {nft?.metadata?.image ? (
                <div
                  id="team-image-container"
                  className="relative flex-shrink-0"
                >
                  <div className="w-[200px] h-[200px] lg:w-[250px] lg:h-[250px]">
                    <IPFSRenderer
                      src={nft?.metadata?.image}
                      className="w-full h-full object-cover rounded-2xl border-4 border-slate-500/50"
                      height={250}
                      width={250}
                      alt="Team Image"
                    />
                  </div>
                  <div
                    id="star-asset-container"
                    className="absolute -bottom-2 -right-2"
                  >
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-2">
                      <Image
                        src="/../.././assets/icon-star.svg"
                        alt=""
                        width={40}
                        height={40}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-[200px] h-[200px] lg:w-[250px] lg:h-[250px] bg-gradient-to-b from-slate-600/50 to-slate-700/50 rounded-2xl border-4 border-slate-500/50 flex items-center justify-center flex-shrink-0">
                  <div className="text-slate-400 text-6xl">🏢</div>
                </div>
              )}
              <div
                id="team-name-container"
                className="flex-1 min-w-0 flex flex-col justify-center min-h-[200px] lg:min-h-[250px]"
              >
                <div id="team-name" className="flex flex-col gap-4 w-full">
                  <div
                    id="team-name-container"
                    className="flex flex-col w-full"
                  >
                    {subIsValid && isManager && (
                      <button
                        className="absolute top-4 right-4 p-2 bg-slate-600/50 hover:bg-slate-500/50 rounded-xl transition-colors"
                        onClick={() => {
                          if (address === nft?.owner || isManager)
                            setTeamMetadataModalEnabled(true)
                          else
                            return toast.error(
                              'Connect the entity admin wallet or multisig to edit metadata.'
                            )
                        }}
                      >
                        <PencilIcon
                          width={24}
                          height={24}
                          className="text-white"
                        />
                      </button>
                    )}
                    {nft ? (
                      <h1 className="font-GoodTimes text-white text-2xl lg:text-4xl font-bold mb-3 break-words">
                        {nft?.metadata?.name}
                      </h1>
                    ) : (
                      <></>
                    )}
                    <div id="profile-container">
                      {nft?.metadata?.description ? (
                        <p className="text-slate-300 text-base leading-relaxed mb-4">
                          {nft?.metadata.description || ''}
                        </p>
                      ) : (
                        <></>
                      )}
                    </div>
                  </div>

                  <div
                    id="interactions-container"
                    className="flex flex-col sm:flex-row items-start gap-4"
                  >
                    {socials && (
                      <div className="flex gap-3">
                        {socials.communications && (
                          <Link
                            className="bg-slate-600/30 backdrop-blur-sm border border-slate-500/50 rounded-xl px-4 py-3 h-12 flex items-center gap-2 hover:bg-slate-500/30 transition-colors"
                            href={socials.communications}
                            target="_blank"
                            passHref
                          >
                            <ChatBubbleLeftIcon
                              height={20}
                              width={20}
                              className="text-slate-300"
                            />
                          </Link>
                        )}
                        {socials.twitter && (
                          <Link
                            className="bg-slate-600/30 backdrop-blur-sm border border-slate-500/50 rounded-xl px-4 py-3 h-12 flex items-center gap-2 hover:bg-slate-500/30 transition-colors"
                            href={socials.twitter}
                            target="_blank"
                            passHref
                          >
                            <TwitterIcon />
                          </Link>
                        )}
                        {socials.website && (
                          <Link
                            className="bg-slate-600/30 backdrop-blur-sm border border-slate-500/50 rounded-xl px-4 py-3 h-12 flex items-center gap-2 hover:bg-slate-500/30 transition-colors"
                            href={socials.website}
                            target="_blank"
                            passHref
                          >
                            <GlobeAltIcon
                              height={20}
                              width={20}
                              className="text-slate-300"
                            />
                          </Link>
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
      </div>
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

      {/*Subscription Extension Container*/}
      {isManager || address === nft.owner ? (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setTeamSubscriptionModalEnabled(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
          >
            <span>Extend Subscription</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      ) : null}

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
          {/* Team Statistics Overview */}
          {!isDeleted && subIsValid && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Team Members"
                value={teamStats.memberCount}
                icon={<UserGroupIcon className="w-6 h-6 text-blue-400" />}
                subtitle="Active members"
              />
              <StatsCard
                title="Open Jobs"
                value={teamStats.jobCount}
                icon={<BriefcaseIcon className="w-6 h-6 text-green-400" />}
                subtitle="Hiring opportunities"
              />
              <StatsCard
                title="Marketplace Items"
                value={teamStats.listingCount}
                icon={<ShoppingBagIcon className="w-6 h-6 text-purple-400" />}
                subtitle="Active listings"
              />
              <StatsCard
                title="Active Missions"
                value={teamStats.missionCount}
                icon={<ChartBarIcon className="w-6 h-6 text-orange-400" />}
                subtitle="Fundraising campaigns"
              />
            </div>
          )}

          {!isDeleted && subIsValid && (
            <div id="entity-actions-container" className=" z-30">
              {isManager || address === nft.owner ? (
                <DashboardCard
                  title="Quick Actions"
                  icon={
                    <Image
                      src="/assets/icon-rocket.svg"
                      alt="Actions"
                      width={30}
                      height={30}
                    />
                  }
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Action
                      title="Fund"
                      description="Launch a mission to raise funds."
                      icon={
                        <BanknotesIcon
                          height={24}
                          width={24}
                          className="text-white"
                        />
                      }
                      onClick={() => router.push('/launch?status=create')}
                    />
                    <Action
                      title="Hire"
                      description="List job openings or contracts to a global talent pool."
                      icon={
                        <ClipboardDocumentListIcon
                          height={24}
                          width={24}
                          className="text-white"
                        />
                      }
                      onClick={() => setTeamJobModalEnabled(true)}
                    />
                    <Action
                      title="Sell"
                      description="List products, services, or ticketed events for sale."
                      icon={
                        <BuildingStorefrontIcon
                          height={24}
                          width={24}
                          className="text-white"
                        />
                      }
                      onClick={() => setTeamListingModalEnabled(true)}
                    />
                  </div>
                </DashboardCard>
              ) : (
                ''
              )}
            </div>
          )}

          {subIsValid && (
            <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
              <TeamTreasury
                isSigner={isSigner}
                safeData={safeData}
                multisigAddress={nft.owner}
                safeOwners={safeOwners}
              />
            </div>
          )}

          {/* Header and socials */}
          {subIsValid && (
            <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
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
                missions={missions}
              />
            </div>
          )}
          {subIsValid && !isDeleted ? (
            <div className="space-y-6 mb-10">
              {/* Team Members */}
              <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 mb-6">
                  <div className="flex gap-5">
                    <Image
                      src={teamIcon}
                      alt="Team icon"
                      width={30}
                      height={30}
                      className="opacity-70"
                    />
                    <h2 className="font-GoodTimes text-2xl text-white">
                      Meet the Team
                    </h2>
                  </div>
                  {isManager && hats?.[0]?.id && (
                    <div
                      id="button-container"
                      className="my-2 flex flex-col md:flex-row justify-start items-center gap-2"
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
                <div className="mt-4">
                  {hats?.[0].id && (
                    <TeamMembers
                      hats={hats}
                      hatsContract={hatsContract}
                      citizenContract={citizenContract}
                    />
                  )}
                </div>
              </div>
              <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                <TeamJobs
                  teamId={tokenId}
                  jobTableContract={jobTableContract}
                  isManager={isManager}
                  isCitizen={citizen}
                  hasFullAccess={hasFullAccess}
                  jobs={jobs}
                />
              </div>
              <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                <TeamMarketplace
                  selectedChain={selectedChain}
                  marketplaceTableContract={marketplaceTableContract}
                  teamContract={teamContract}
                  isManager={isManager}
                  teamId={tokenId}
                  isCitizen={citizen}
                  listings={listings}
                />
              </div>
              {/* General Actions */}
              {isManager && (
                <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                  <GeneralActions />
                </div>
              )}
            </div>
          ) : (
            // Subscription Expired
            <div className="bg-gradient-to-b from-red-900/20 to-red-800/30 rounded-2xl border border-red-600/30 p-6 mb-10">
              <div className="text-center mb-6">
                <h3 className="text-xl font-GoodTimes text-white mb-2">
                  {isDeleted ? 'Profile Deleted' : 'Subscription Expired'}
                </h3>
                <p className="text-slate-300">
                  {isDeleted
                    ? `The profile has been deleted, please connect the owner or admin wallet to submit new data.`
                    : `The profile has expired, please connect the owner or admin wallet to renew.`}
                </p>
              </div>

              <div className="bg-slate-600/20 rounded-xl border border-slate-500/30">
                <TeamTreasury
                  isSigner={isSigner}
                  safeData={safeData}
                  multisigAddress={nft.owner}
                  safeOwners={safeOwners}
                />
              </div>
            </div>
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

  if (!nft || BLOCKED_TEAMS.has(Number(nft.metadata.id))) {
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
