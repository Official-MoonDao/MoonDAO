//Citizen Profile
import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import {
  GlobeAltIcon,
  LockClosedIcon,
  LockOpenIcon,
  MapPinIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  MOONDAO_HAT_TREE_IDS,
  TEAM_ADDRESSES,
} from 'const/config'
import { HATS_ADDRESS } from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { useCitizenData } from '@/lib/citizen/useCitizenData'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import useNewestProposals from '@/lib/nance/useNewestProposals'
import { useVotesOfAddress } from '@/lib/snapshot'
import { generatePrettyLinks } from '@/lib/subscription/pretty-links'
import { citizenRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { useTotalMooneyBalance } from '@/lib/tokens/hooks/useTotalMooneyBalance'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import { getAttribute } from '@/lib/utils/nft'
import { DiscordIcon, TwitterIcon } from '@/components/assets'
import { Hat } from '@/components/hats/Hat'
import Address from '@/components/layout/Address'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import Action from '@/components/subscription/Action'
import Card from '@/components/subscription/Card'
import CitizenActions from '@/components/subscription/CitizenActions'
import CitizenMetadataModal from '@/components/subscription/CitizenMetadataModal'
import GeneralActions from '@/components/subscription/GeneralActions'
import GuestActions from '@/components/subscription/GuestActions'
import LatestJobs from '@/components/subscription/LatestJobs'
import NewMarketplaceListings from '@/components/subscription/NewMarketplaceListings'
import OpenVotes from '@/components/subscription/OpenVotes'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import CitizenABI from '../../const/abis/Citizen.json'
import HatsABI from '../../const/abis/Hats.json'
import JobsABI from '../../const/abis/JobBoardTable.json'
import MarketplaceABI from '../../const/abis/MarketplaceTable.json'

export default function CitizenDetailPage({ nft, tokenId, hats }: any) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const { citizen } = useContext(CitizenContext)
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const [subModalEnabled, setSubModalEnabled] = useState(false)
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] =
    useState(false)

  const isGuest = tokenId === 'guest'

  // Contracts
  const citizenContract = useContract({
    chain: selectedChain,
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
  })

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })

  const marketplaceTableContract = useContract({
    chain: selectedChain,
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    abi: MarketplaceABI as any,
  })

  const jobTableContract = useContract({
    chain: selectedChain,
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    abi: JobsABI as any,
  })

  const {
    socials,
    location,
    discordLink,
    isDeleted,
    subIsValid,
    incompleteProfile,
    isLoading: isLoadingCitizenData,
  } = useCitizenData(nft, citizenContract)

  const isOwner = address?.toLowerCase() === nft?.owner?.toLowerCase()

  const { data: votes } = useVotesOfAddress(nft?.owner)

  // Balances
  const nativeBalance = useNativeBalance()

  const MOONEYBalance = useTotalMooneyBalance(isGuest ? address : nft?.owner)

  const { walletVP: VMOONEYBalance } = useTotalVP(nft?.owner)

  // Subscription Data
  const [expiresAt, setExpiresAt] = useState<any>()
  useEffect(() => {
    async function checkExpiration() {
      const expiresAt = await readContract({
        contract: citizenContract,
        method: 'expiresAt' as string,
        params: [nft?.metadata?.id || ''],
      })
      setExpiresAt(expiresAt)
    }
    if (citizenContract && nft?.metadata?.id && !isGuest) checkExpiration()
  }, [citizenContract, nft?.metadata?.id, isGuest])

  const hatsContract = useContract({
    chain: selectedChain,
    address: HATS_ADDRESS,
    abi: HatsABI as any,
  })

  //Nance
  const { proposals, packet, votingInfoMap } = useNewestProposals(100)

  useChainDefault()

  const ProfileHeader = (
    <div id="citizenheader-container" className="w-full">
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
                  id="citizen-image-container"
                  className="relative flex-shrink-0"
                >
                  <div className="w-[200px] h-[200px] lg:w-[250px] lg:h-[250px]">
                    <IPFSRenderer
                      src={nft?.metadata?.image}
                      className="w-full h-full object-cover rounded-2xl border-4 border-slate-500/50"
                      height={250}
                      width={250}
                      alt="Citizen Image"
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
                  <div className="text-slate-400 text-6xl">👤</div>
                </div>
              )}
              <div id="citizen-name-container" className="flex-1 min-w-0 flex flex-col justify-center min-h-[200px] lg:min-h-[250px]">
                <div
                  id="team-name"
                  className="flex flex-col gap-4 w-full"
                >
                  <div
                    id="team-name-container"
                    className="flex flex-col w-full"
                  >
                    {subIsValid && isOwner && (
                      <button
                        className="absolute top-4 right-4 p-2 bg-slate-600/50 hover:bg-slate-500/50 rounded-xl transition-colors"
                        onClick={() => {
                          if (isOwner) setCitizenMetadataModalEnabled(true)
                          else
                            return toast.error(
                              'Connect the entity admin wallet or multisig to edit metadata.'
                            )
                        }}
                      >
                        <PencilIcon width={24} height={24} className="text-white" />
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
                    {(discordLink &&
                      !discordLink.includes('/users/undefined')) ||
                    (socials && (socials.twitter || socials.website)) ? (
                      <div
                        id="socials-container"
                        className="flex items-center gap-3 bg-slate-600/30 backdrop-blur-sm border border-slate-500/50 rounded-xl px-4 py-2"
                      >
                        {discordLink &&
                          !discordLink.includes('/users/undefined') && (
                            <Link
                              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
                              href={discordLink}
                              target="_blank"
                              passHref
                            >
                              <DiscordIcon />
                            </Link>
                          )}
                        {socials.twitter && (
                          <Link
                            className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
                            href={socials.twitter}
                            target="_blank"
                            passHref
                          >
                            <TwitterIcon />
                          </Link>
                        )}
                        {socials.website && (
                          <Link
                            className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
                            href={socials.website}
                            target="_blank"
                            passHref
                          >
                            <GlobeAltIcon height={20} width={20} className="text-white" />
                          </Link>
                        )}
                      </div>
                    ) : null}

                    {citizen || isGuest ? (
                      <div className="bg-slate-600/30 backdrop-blur-sm border border-slate-500/50 rounded-xl px-4 py-3 h-12 flex items-center">
                        <Address address={isGuest ? address : nft.owner} />
                      </div>
                    ) : (
                      <></>
                    )}

                    {location !== '' && citizen && (
                      <div className="bg-slate-600/30 backdrop-blur-sm border border-slate-500/50 rounded-xl px-4 py-3 h-12 flex items-center gap-2">
                        <MapPinIcon
                          width={20}
                          height={20}
                          className="flex-shrink-0 text-slate-300"
                        />
                        <Link className="font-GoodTimes text-white hover:text-slate-200 transition-colors" href="/map">
                          {location.startsWith('[object') ? '' : location}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Container>
      <ContentLayout
        description={ProfileHeader}
        preFooter={<NoticeFooter citizenNotice={isGuest} />}
        mainPadding
        mode="compact"
        popOverEffect={false}
        branded={false}
        isProfile
      >
        {/* Header and socials */}
        <Head
          title={nft?.metadata?.name}
          description={nft?.metadata?.description}
          image={`https://ipfs.io/ipfs/${
            nft?.metadata?.image.split('ipfs://')[1]
          }`}
        />
        {!isDeleted && subIsValid && isOwner && (
          <CitizenActions
            nft={nft}
            address={address || ''}
            incompleteProfile={incompleteProfile}
            isTeamMember={hats?.length > 0}
            mooneyBalance={MOONEYBalance}
            vmooneyBalance={VMOONEYBalance}
            setCitizenMetadataModalEnabled={setCitizenMetadataModalEnabled}
          />
        )}

        {citizenMetadataModalEnabled && (
          <CitizenMetadataModal
            nft={nft}
            selectedChain={selectedChain}
            setEnabled={setCitizenMetadataModalEnabled}
          />
        )}
        {subModalEnabled && (
          <SubscriptionModal
            selectedChain={selectedChain}
            setEnabled={setSubModalEnabled}
            nft={nft}
            subscriptionContract={citizenContract}
            validPass={subIsValid}
            expiresAt={expiresAt}
            type="citizen'"
          />
        )}

        {!isGuest && !citizen && !isOwner && subIsValid && !isDeleted && (
          <Action
            title="Unlock Full Profile"
            description="Become a Citizen of the Space Acceleration Network to view the full profile. Citizenship also unlocks access to the jobs board, marketplace discounts, and more benefits."
            icon={<LockOpenIcon width={30} height={30} />}
            onClick={() => router.push('/citizen')}
          />
        )}
        {subIsValid && !isDeleted && !isGuest ? (
          <div className="space-y-6 mb-10">
            {/* Mooney and Voting Power */}
            {citizen || isOwner ? (
              <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-GoodTimes text-2xl text-white">
                    Governance
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-600/20 rounded-xl p-4">
                    <p className="text-lg text-slate-300 mb-2">$MOONEY</p>
                    <p className="text-3xl font-bold text-white">
                      {MOONEYBalance
                        ? Math.round(MOONEYBalance).toLocaleString()
                        : 0}
                    </p>
                  </div>
                  <div className="bg-slate-600/20 rounded-xl p-4">
                    <p className="text-lg text-slate-300 mb-2">Voting Power</p>
                    <p className="text-3xl font-bold text-white">
                      {VMOONEYBalance
                        ? Math.round(VMOONEYBalance).toLocaleString()
                        : 0}
                    </p>
                  </div>
                  <div className="bg-slate-600/20 rounded-xl p-4">
                    <p className="text-lg text-slate-300 mb-2">Votes</p>
                    <p className="text-3xl font-bold text-white">{votes?.length}</p>
                  </div>
                </div>
                {isOwner && (
                  <div className="flex flex-col sm:flex-row mt-6 gap-4">
                    <StandardButton
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl py-3 px-6 font-semibold transition-all duration-200 hover:scale-105"
                      onClick={() => router.push('/get-mooney')}
                    >
                      Get $MOONEY
                    </StandardButton>
                    <StandardButton
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl py-3 px-6 font-semibold transition-all duration-200 hover:scale-105"
                      onClick={() => router.push('/lock')}
                    >
                      Get Voting Power
                    </StandardButton>
                  </div>
                )}
              </div>
            ) : (
              <></>
            )}
            {isOwner && (
              <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                <OpenVotes
                  proposals={proposals}
                  packet={packet}
                  votingInfoMap={votingInfoMap}
                />
              </div>
            )}
            {hats && hats?.length > 0 && (
              <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
                <h2 className="font-GoodTimes text-2xl text-white mb-6">Teams</h2>
                <div className="space-y-4">
                  {hats?.map((hat: any) => (
                    <div
                      key={hat.id}
                      className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors"
                    >
                      <Hat
                        selectedChain={selectedChain}
                        hat={hat}
                        hatsContract={hatsContract}
                        teamImage
                        teamContract={teamContract}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isOwner && (
              <>
                <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                  <NewMarketplaceListings
                    selectedChain={selectedChain}
                    teamContract={teamContract}
                    marketplaceTableContract={marketplaceTableContract}
                  />
                </div>
                <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                  <LatestJobs
                    teamContract={teamContract}
                    jobTableContract={jobTableContract}
                  />
                </div>
                <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30">
                  <GeneralActions />
                </div>
              </>
            )}
          </div>
        ) : isGuest ? (
          <>
            <GuestActions
              address={address}
              nativeBalance={nativeBalance}
              citizenContract={citizenContract}
            />
          </>
        ) : (
          // Subscription expired
          <div className="bg-gradient-to-b from-red-900/20 to-red-800/30 rounded-2xl border border-red-600/30 p-6 mb-10">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <LockClosedIcon className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-GoodTimes text-white mb-2">
                {isDeleted ? 'Profile Deleted' : 'Subscription Expired'}
              </h3>
              <p className="text-slate-300">
                {isDeleted
                  ? `This profile has been deleted. Please connect the owner's wallet to submit new data.`
                  : `The profile has expired. Please connect the owner's wallet to renew.`}
              </p>
            </div>
          </div>
        )}
      </ContentLayout>
    </Container>
  )
}

async function getTeamWearerServerSide(
  chain: any,
  teamContract: any,
  address: any
) {
  try {
    if (!address) return []

    const chainSlug = getChainSlug(chain)

    // Get wearer hats from subgraph
    const hats = await hatsSubgraphClient.getWearer({
      chainId: chain.id,
      wearerAddress: address,
      props: {
        currentHats: {
          props: {
            tree: {},
            admin: {
              admin: {
                admin: {},
              },
            },
          },
        },
      },
    })

    if (hats.currentHats) {
      // Filter hats to only include hats that are in the MoonDAO hat tree
      const moondaoHats = hats.currentHats.filter(
        (hat: any) => hat.tree.id === MOONDAO_HAT_TREE_IDS[chainSlug]
      )

      // Add the teamId to each hat
      const moondaoHatsWithTeamId = await Promise.all(
        moondaoHats.map(async (hat: any) => {
          const teamIdFromHat = await readContract({
            contract: teamContract,
            method: 'adminHatToTokenId' as string,
            params: [hat.id],
          })
          const teamIdFromAdmin = await readContract({
            contract: teamContract,
            method: 'adminHatToTokenId' as string,
            params: [hat.admin.id],
          })
          const teamIdFromAdminAdmin = await readContract({
            contract: teamContract,
            method: 'adminHatToTokenId' as string,
            params: [hat.admin.admin.id],
          })

          let teamId
          if (+teamIdFromHat.toString() !== 0) {
            teamId = teamIdFromHat
          } else if (+teamIdFromAdmin.toString() !== 0) {
            teamId = teamIdFromAdmin
          } else if (+teamIdFromAdminAdmin.toString() !== 0) {
            teamId = teamIdFromAdminAdmin
          } else {
            teamId = 0
          }

          const adminHatId = await readContract({
            contract: teamContract,
            method: 'teamAdminHat' as string,
            params: [teamId],
          })
          const prettyAdminHatId = hatIdDecimalToHex(
            BigInt(adminHatId.toString())
          )

          if (
            hat.id === prettyAdminHatId ||
            hat.admin.id === prettyAdminHatId ||
            hat.admin.admin.id === prettyAdminHatId ||
            hat.admin.admin.admin.id === prettyAdminHatId
          ) {
            return {
              ...hat,
              teamId: teamId.toString(),
            }
          }
          return null
        })
      ).then((results) => results.filter((result) => result !== null))

      return moondaoHatsWithTeamId
    } else {
      return []
    }
  } catch (err) {
    console.log(err)
    return []
  }
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenIdOrName: any = params?.tokenIdOrName

  let nft, tokenId: any
  if (tokenIdOrName === 'guest') {
    nft = {
      metadata: {
        name: 'Your Name Here',
        description:
          'Start your journey with the Space Acceleration Network by funding your wallet and becoming a Citizen to unlock a myriad of benefits.',
        image: '/assets/citizen-default.png',
        uri: '',
        id: 'guest',
        attributes: [
          {
            trait_type: 'location',
            value: '',
          },
          {
            trait_type: 'view',
            value: 'public',
          },
        ],
      },
      owner: '',
    }

    tokenId = 'guest'
  } else {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const statement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}`
    const allCitizens = (await queryTable(chain, statement)) as any

    const { prettyLinks } = generatePrettyLinks(allCitizens, {
      allHaveTokenId: true,
    })

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

    const citizen = allCitizens.find((citizen: any) => +citizen.id === +tokenId)

    const nft = citizenRowToNFT(citizen)

    if (!nft || blockedCitizens.includes(Number(nft?.metadata?.id))) {
      return {
        notFound: true,
      }
    }

    const teamContract = getContract({
      client: serverClient,
      chain: chain,
      address: TEAM_ADDRESSES[chainSlug],
      abi: TeamABI as any,
    })

    const hats = await getTeamWearerServerSide(chain, teamContract, nft.owner)

    console.log('HATS', hats)

    return {
      props: {
        nft,
        tokenId,
        hats,
      },
    }
  }

  return {
    props: {
      nft,
      tokenId,
      hats: [],
    },
  }
}
