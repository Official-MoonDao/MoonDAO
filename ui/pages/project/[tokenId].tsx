import { PencilIcon } from '@heroicons/react/24/outline'
import {
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useContractRead,
  useSDK,
} from '@thirdweb-dev/react'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  TEAM_ADDRESSES,
  HATS_ADDRESS,
  MOONEY_ADDRESSES,
  ZERO_ADDRESS,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSubHats } from '@/lib/hats/useSubHats'
import useProjectData from '@/lib/project/useProjectData'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import Address from '@/components/layout/Address'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import GeneralActions from '@/components/subscription/GeneralActions'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import TeamDonation from '@/components/subscription/TeamDonation'
import TeamManageMembers from '@/components/subscription/TeamManageMembers'
import TeamMembers from '@/components/subscription/TeamMembers'
import TeamMetadataModal from '@/components/subscription/TeamMetadataModal'
import TeamTreasury from '@/components/subscription/TeamTreasury'
import ProjectActions from '@/components/subscription/project/ProjectActions'

export default function ProjectProfile({ tokenId, nft, imageIpfsLink }: any) {
  const sdk = useSDK()
  const address = useAddress()

  const { selectedChain } = useContext(ChainContext)

  //Modal states
  const [teamMetadataModalEnabled, setTeamMetadataModalEnabled] =
    useState(false)
  const [teamSubscriptionModalEnabled, setTeamSubscriptionModalEnabled] =
    useState(false)

  //Contracts
  const { contract: hatsContract } = useContract(HATS_ADDRESS)
  const { contract: projectContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug],
    TeamABI
  )
  const { contract: citizenConract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, nft?.owner)

  const {
    adminHatId,
    managerHatId,
    isManager,
    subIsValid,
    isActive,
    isLoading: isLoadingProjectData,
  } = useProjectData(projectContract, hatsContract, nft)
  //Hats
  const hats = useSubHats(selectedChain, adminHatId)

  const [nativeBalance, setNativeBalance] = useState<number>(0)

  //Subscription Data
  const { data: expiresAt } = useContractRead(projectContract, 'expiresAt', [
    nft?.metadata?.id,
  ])

  // get native balance for multisigj
  useEffect(() => {
    async function getNativeBalance() {
      const provider = sdk?.getProvider()
      const balance: any = await provider?.getBalance(nft?.owner as string)
      setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
    }

    if (sdk && nft?.owner) {
      getNativeBalance()
    }
  }, [sdk, nft])

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
                    {isManager || address === nft.owner ? (
                      ''
                    ) : (
                      <div
                        id="donation-container"
                        className="flex items-center max-w-[290px]"
                      >
                        {!isActive && subIsValid && (
                          <TeamDonation recipient={nft?.owner} />
                        )}
                      </div>
                    )}

                    {/*Subscription Extension Container*/}
                    {/* {isManager || address === nft.owner ? (
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
                                  <Button
                                    onClick={() => {
                                      setTeamSubscriptionModalEnabled(true)
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
                  {/* {isManager || address === nft.owner ? (
                      <p className="opacity-50 mt-2 text-sm">
                        {'Exp: '}
                        {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                      </p>
                    ) : (
                      <></>
                    )} */}
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
        description={nft.metadata.description}
        image={`https://ipfs.io/ipfs/${imageIpfsLink.split('ipfs://')[1]}`}
      />
      {teamSubscriptionModalEnabled && (
        <SubscriptionModal
          selectedChain={selectedChain}
          setEnabled={setTeamSubscriptionModalEnabled}
          nft={nft}
          validPass={subIsValid}
          expiresAt={expiresAt}
          subscriptionContract={projectContract}
        />
      )}
      {teamMetadataModalEnabled && (
        <TeamMetadataModal
          nft={nft}
          selectedChain={selectedChain}
          setEnabled={setTeamMetadataModalEnabled}
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
          <div id="entity-actions-container" className=" z-30">
            <div
              id="team-actions-container"
              className="px-5 pt-5 md:px-0 md:pt-0"
            >
              <ProjectActions
                nft={nft}
                projectContract={projectContract}
                isActive={isActive}
                isManager={isManager}
                hasFinalReport={false}
              />
            </div>
          </div>

          {/* Header and socials */}
          {subIsValid ? (
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
                    {isManager && (
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
                          hats={hats}
                          hatsContract={hatsContract}
                          teamContract={projectContract}
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
                          citizenConract={citizenConract}
                        />
                      )}
                    </div>
                  </SlidingCardMenu>
                </div>
              </Frame>
              {/* Mooney and Voting Power */}
              {isManager && (
                <TeamTreasury
                  multisigAddress={nft.owner}
                  mutlisigMooneyBalance={MOONEYBalance}
                  multisigNativeBalance={nativeBalance}
                />
              )}
              {/* General Actions */}
              {isManager && <GeneralActions />}
            </div>
          ) : (
            // Subscription Expired
            <Frame>
              {isManager && (
                <TeamTreasury
                  multisigAddress={nft.owner}
                  mutlisigMooneyBalance={MOONEYBalance}
                  multisigNativeBalance={nativeBalance}
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
  //   const tokenId: any = params?.tokenId

  //   const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  //   const sdk = initSDK(chain)

  //   if (tokenId === undefined) {
  //     return {
  //       notFound: true,
  //     }
  //   }

  //   const teamContract = await sdk.getContract(
  //     TEAM_ADDRESSES[chain.slug],
  //     TeamABI
  //   )
  //   const nft = await teamContract.erc721.get(tokenId)

  //   if (
  //     !nft ||
  //     !nft.metadata.uri ||
  //     blockedTeams.includes(Number(nft.metadata.id))
  //   ) {
  //     return {
  //       notFound: true,
  //     }
  //   }

  //   const rawMetadataRes = await fetch(nft.metadata.uri)
  //   const rawMetadata = await rawMetadataRes.json()
  //   const imageIpfsLink = rawMetadata.image

  const tokenId = '0'
  const imageIpfsLink =
    'https://ipfs.io/ipfs/QmQrX8HmgQAgVsWJdcqM4D5X85yo25hSt3jvXWv5Ytf5gG'

  const nft = {
    owner: ZERO_ADDRESS,
    metadata: {
      name: 'Project #1',
      description: 'Project #1 Description',
      image:
        'https://ipfs.io/ipfs/QmQrX8HmgQAgVsWJdcqM4D5X85yo25hSt3jvXWv5Ytf5gG',
      id: '0',

      attributes: [
        {
          trait_type: 'website',
          value: 'Project Website',
        },
      ],
    },
  }

  return {
    props: {
      nft,
      tokenId,
      imageIpfsLink,
    },
  }
}
