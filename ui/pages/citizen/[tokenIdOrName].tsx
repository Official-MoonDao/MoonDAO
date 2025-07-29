//Citizen Profile
import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import {
  GlobeAltIcon,
  LockOpenIcon,
  MapPinIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
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

  const VMOONEYBalance = useTotalVP(nft?.owner)

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
    <div id="citizenheader-container">
      <div className="z-50 rounded-tl-[20px] overflow-hidden">
        <div id="frame-content-container" className="w-full">
          <div
            id="moon-asset-container"
            className="bg-white rounded-[100%] w-[100px] h-[100px] absolute top-5 lg:left-[40px]"
          ></div>
          <div
            id="frame-content"
            className="w-full flex flex-col lg:flex-row items-start justify-between"
          >
            <div
              id="profile-description-section"
              className="flex w-full flex-col lg:flex-row items-start lg:items-center"
            >
              {nft?.metadata?.image ? (
                <div
                  id="citizen-image-container"
                  className="relative w-full max-w-[350px] h-full md:min-w-[300px] md:min-h-[300px] md:max-w-[300px] md:max-h-[300px]"
                >
                  <IPFSRenderer
                    src={nft?.metadata?.image}
                    className="rounded-full"
                    height={300}
                    width={300}
                    alt="Citizen Image"
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
              <div id="citizen-name-container">
                <div
                  id="team-name"
                  className="flex mb-2 w-full flex-col justify-center gap-2 lg:ml-5"
                >
                  <div
                    id="team-name-container"
                    className="mt-5 lg:mt-0 flex flex-col flex-col-reverse w-full items-start justify-start"
                  >
                    {subIsValid && isOwner && (
                      <button
                        className={'absolute top-6 right-6'}
                        onClick={() => {
                          if (isOwner) setCitizenMetadataModalEnabled(true)
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
                        {nft?.metadata?.name}
                      </h1>
                    ) : (
                      <></>
                    )}
                    <div id="profile-container">
                      {nft?.metadata?.description ? (
                        <p
                          id="profile-description-container"
                          className="w-full pr-12"
                        >
                          {nft?.metadata.description || ''}
                        </p>
                      ) : (
                        <></>
                      )}
                    </div>
                  </div>
                  <div
                    id="interactions-container"
                    className="flex flex-col md:flex-row items-start justify-start lg:pr-10"
                  >
                    {(discordLink &&
                      !discordLink.includes('/users/undefined')) ||
                    (socials && (socials.twitter || socials.website)) ? (
                      <div
                        id="socials-container"
                        className="p-1.5 mb-2 mr-2 md:mb-0 px-5 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] flex text-sm bg-filter"
                      >
                        {discordLink &&
                          !discordLink.includes('/users/undefined') && (
                            <Link
                              className="flex gap-2"
                              href={discordLink}
                              target="_blank"
                              passHref
                            >
                              <DiscordIcon />
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
                    ) : null}
                    {/* {isOwner ? (
                      <div id="manager-container">
                        {expiresAt && (
                          <div
                            id="expires-container"
                            className="flex flex-col gap-4 items-start"
                          >
                            <div className="rounded-[2vmax] rounded-tl-[10px] md:rounded-tl-[2vmax] md:rounded-bl-[10px] overflow-hidden">
                              <div
                                id="extend-sub-button"
                                className="gradient-2 text-sm"
                              >
                                <Button
                                  onClick={() => {
                                    if (isOwner)
                                      setSubModalEnabled(true)
                                    else
                                      return toast.error(
                                        `Connect the entity admin wallet or multisig to extend the subscription.`
                                      )
                                  }}
                                >
                                  {'Extend Plan'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <></>
                    )} */}
                  </div>
                </div>
                {/* {isOwner ? (
                  <p className="opacity-50 mt-2 lg:ml-5 text-sm">
                    {'Exp: '}
                    {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                  </p>
                ) : (
                  <></>
                )} */}
                {citizen || isGuest ? (
                  <>
                    <div className="mt-4 lg:ml-5">
                      <Address address={isGuest ? address : nft.owner} />
                    </div>
                  </>
                ) : (
                  <></>
                )}

                {location !== '' && citizen && (
                  <div className="mt-2 flex items-center gap-2 lg:ml-5">
                    <MapPinIcon
                      width={30}
                      height={30}
                      className="flex-shrink-0"
                    />
                    <Link className="font-GoodTimes" href="/map">
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

        {!isGuest && !citizen && (
          <Action
            title="Unlock Full Profile"
            description="Become a Citizen of the Space Acceleration Network to view the full profile. Citizenship also unlocks access to the jobs board, marketplace discounts, and more benefits."
            icon={<LockOpenIcon width={30} height={30} />}
            onClick={() => router.push('/citizen')}
          />
        )}
        {subIsValid && !isDeleted && !isGuest ? (
          <div className="z-50 mb-10">
            {/* Mooney and Voting Power */}
            {citizen || isOwner ? (
              <Frame
                noPadding
                bottomLeft="0px"
                bottomRight="0px"
                topRight="0px"
                topLeft="0px"
              >
                <div className="z-50 w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
                  <div id="vote-title-section" className="flex justify-between">
                    <h2 className="header font-GoodTimes opacity-[50%]">
                      Governance
                    </h2>
                  </div>
                  <div className="mt-5 flex flex-col gap-5">
                    <div>
                      <p className="text-xl">{`$MOONEY`}</p>
                      <p className="text-3xl">
                        {MOONEYBalance
                          ? Math.round(MOONEYBalance).toLocaleString()
                          : 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xl">{`Voting Power`}</p>
                      <p className="text-2xl">
                        {VMOONEYBalance
                          ? Math.round(VMOONEYBalance).toLocaleString()
                          : 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xl">{`Votes`}</p>
                      <p className="text-2xl">{votes?.length}</p>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex flex-col md:flex-row mt-4 md:px-4 flex items-start xl:items-end gap-2">
                      <StandardButton
                        className="w-full gradient-2 rounded-[10px] rounded-tr-[20px] rounded-br-[20px] md:rounded-tr-[10px] md:rounded-br-[10px] md:rounded-bl-[20px] md:hover:pl-5"
                        onClick={() => router.push('/get-mooney')}
                      >
                        {'Get $MOONEY'}
                      </StandardButton>
                      <StandardButton
                        className="w-full gradient-2 rounded-[10px] rounded-tr-[20px] rounded-br-[20px] md:hover:pl-5"
                        onClick={() => router.push('/lock')}
                      >
                        {'Get Voting Power'}
                      </StandardButton>
                    </div>
                  )}
                </div>
              </Frame>
            ) : (
              <></>
            )}
            {isOwner && (
              <div className="mt-4">
                <Frame
                  noPadding
                  bottomLeft="0px"
                  bottomRight="0px"
                  topRight="0px"
                  topLeft="0px"
                >
                  <OpenVotes
                    proposals={proposals}
                    packet={packet}
                    votingInfoMap={votingInfoMap}
                  />
                </Frame>
              </div>
            )}
            {hats && hats?.length > 0 && (
              <Frame
                noPadding
                bottomLeft="0px"
                bottomRight="0px"
                topRight="0px"
                topLeft="0px"
              >
                <div className="flex flex-col 2xl:flex-row">
                  <div className=" w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
                    <p className="header font-GoodTimes opacity-[50%]">Teams</p>
                    <div className="mt-5 py-5 flex flex-col gap-2 overflow-y-scroll">
                      {hats?.map((hat: any) => (
                        <div
                          key={hat.id}
                          className="py-3 gradient-16 rounded-[20px]"
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
                  {/* General Actions */}
                </div>
              </Frame>
            )}
            {isOwner && (
              <>
                <Frame
                  noPadding
                  bottomLeft="0px"
                  bottomRight="0px"
                  topRight="0px"
                  topLeft="0px"
                >
                  <NewMarketplaceListings
                    selectedChain={selectedChain}
                    teamContract={teamContract}
                    marketplaceTableContract={marketplaceTableContract}
                  />
                </Frame>
                <Frame
                  noPadding
                  bottomLeft="0px"
                  bottomRight="0px"
                  topRight="0px"
                  topLeft="0px"
                >
                  <LatestJobs
                    teamContract={teamContract}
                    jobTableContract={jobTableContract}
                  />
                </Frame>
                <Frame
                  noPadding
                  bottomLeft="0px"
                  bottomRight="0px"
                  topRight="0px"
                  topLeft="0px"
                >
                  <GeneralActions />
                </Frame>
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
          <Card>
            <p className="text-white">
              {isDeleted
                ? `This profile has been deleted, please connect the owner's wallet to submit new data.`
                : `The profile has expired, please connect the owner's wallet to renew.`}
            </p>
          </Card>
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
