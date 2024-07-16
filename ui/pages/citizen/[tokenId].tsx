import { ArrowUpRightIcon, GlobeAltIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains';
import { ThirdwebNftMedia, useAddress, useContract } from '@thirdweb-dev/react';
import { CITIZEN_ADDRESSES, MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from 'const/config';
import { blockedCitizens } from 'const/whitelist';
import { GetServerSideProps } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useCitizenData } from '@/lib/citizen/useCitizenData';
import { useWearer } from '@/lib/hats/useWearer';
import ChainContext from '@/lib/thirdweb/chain-context';
import { useHandleRead } from '@/lib/thirdweb/hooks';
import { initSDK } from '@/lib/thirdweb/thirdweb';
import { useMOONEYBalance } from '@/lib/tokens/mooney-token';
import { useVMOONEYBalance } from '@/lib/tokens/ve-token';
import { CopyIcon, DiscordIcon, TwitterIcon } from '@/components/assets';
import { Hat } from '@/components/hats/Hat';
import Container from '@/components/layout/Container';
import ContentLayout from '@/components/layout/ContentLayout';
import Frame from '@/components/layout/Frame';
import Head from '@/components/layout/Head';
import StandardButton from '@/components/layout/StandardButton';
import Button from '@/components/subscription/Button';
import Card from '@/components/subscription/Card';
import { CitizenMetadataModal } from '@/components/subscription/CitizenMetadataModal';
import GeneralActions from '@/components/subscription/GeneralActions';
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal';
import { NoticeFooter } from '@/components/layout/NoticeFooter';
import { useTeamData } from '@/lib/team/useTeamData';
import { HATS_ADDRESS } from 'const/config';


export default function CitizenDetailPage({
  nft,
  tokenId,
  imageIpfsLink,
}: any) {
  const router = useRouter();
  const address = useAddress();
  const { selectedChain, setSelectedChain } = useContext(ChainContext);

  const [subModalEnabled, setSubModalEnabled] = useState(false);
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] = useState(false);

  // Data
  const { contract: citizenContract } = useContract(CITIZEN_ADDRESSES[selectedChain.slug]);

  const {
    socials,
    discordLink,
    isDeleted,
    subIsValid,
    isLoading: isLoadingCitizenData,
  } = useCitizenData(nft, citizenContract);

  // Balances
  const { contract: mooneyContract } = useContract(MOONEY_ADDRESSES[selectedChain.slug]);
  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, nft?.owner);
  const { contract: vMooneyContract } = useContract(VMOONEY_ADDRESSES[selectedChain.slug]);
  const { data: VMOONEYBalance } = useVMOONEYBalance(vMooneyContract, nft?.owner);

  // Subscription Data
  const { data: expiresAt } = useHandleRead(citizenContract, 'expiresAt', [
    nft?.metadata?.id || '',
  ]);

  // Hats
  const hats = useWearer(selectedChain, nft?.owner);
  const { contract: hatsContract } = useContract(HATS_ADDRESS);
  const { isManager } = useTeamData(hatsContract, address, nft);

  useEffect(() => {
    setSelectedChain(process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia);
  }, []);

  const ProfileHeader = (
    <div id="citizenheader-container"
      >
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
              {nft?.metadata.image ? (
                <div
                  id="citizen-image-container"
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
              <div id="team-name-container"
                >
                <div
                  id="team-name"
                  className="flex w-full flex-col justify-center gap-2 ml-5"
                >
                  <div
                    id="team-name-container"
                    className="flex flex-col flex-col-reverse w-full items-start justify-start"
                    >
                    {subIsValid && address === nft?.owner && (
                      <button
                        className={'absolute top-6 right-6'}
                        onClick={() => {
                          if (address === nft?.owner)
                            setCitizenMetadataModalEnabled(true)
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
                    <div id="profile-container">
                      {nft?.metadata.description ? (
                        <p
                          id="profile-description-container"
                          className="w-full"
                        >
                          {nft?.metadata.description || ''}
                        </p>
                      ) : (
                        <></>
                      )}
                    </div>  
                  </div>

                  {socials ? (
                    <div
                      id="socials-container"
                      className="pl-5 mt-5 lg:mt-0 max-w-[160px] gap-5 rounded-bl-[10px] rounded-[2vmax] md:rounded-[vmax] flex text-sm bg-filter p-2"
                    >
                      {discordLink && (
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
                  ) : (
                    <></>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {address === nft.owner ? (
          <div id="manager-container" className="mt-8 xl:mt-0">
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
                        if (address === nft?.owner) setSubModalEnabled(true)
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

  return (
    <Container>
      <ContentLayout
        description={ProfileHeader}
        preFooter={
          <NoticeFooter
            isManager={isManager}
            isCitizen={!!address && !isManager && subIsValid}
          />
        }
        mainPadding
        mode="compact"
        popOverEffect={false}
        branded={false}
        isProfile
      >
        {/* Header and socials */}
        <Head
          title={nft.metadata.name}
          description={nft.metadata.description}
          image={`https://ipfs.io/ipfs/${imageIpfsLink.split('ipfs://')[1]}`}
        />

        {citizenMetadataModalEnabled && (
          <CitizenMetadataModal
            nft={nft}
            selectedChain={selectedChain}
            setEnabled={setCitizenMetadataModalEnabled}
          />
        )}
        {subModalEnabled && (
          <SubscriptionModal
            setEnabled={setSubModalEnabled}
            nft={nft}
            subscriptionContract={citizenContract}
            validPass={subIsValid}
            expiresAt={expiresAt}
          />
        )}

        {subIsValid && !isDeleted ? (
          <div className="z-50">
            {/* Mooney and Voting Power */}
            <Frame
              noPadding
              bottomLeft="0px"
              bottomRight="0px"
              topRight="0px"
              topLeft="0px"
            >
              <div className="z-50 w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
                <h2 className="header font-GoodTimes opacity-[50%]">Assets</h2>
                <div className="mt-5 flex flex-col gap-5">
                  <div>
                    <p className="text-xl">{`$MOONEY`}</p>
                    <p className="text-3xl">
                      {MOONEYBalance
                        ? (
                            MOONEYBalance?.toString() /
                            10 ** 18
                          ).toLocaleString()
                        : 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl">{`Voting Power`}</p>
                    <p className="text-2xl">
                      {VMOONEYBalance
                        ? (
                            VMOONEYBalance?.toString() /
                            10 ** 18
                          ).toLocaleString()
                        : 0}
                    </p>
                  </div>
                </div>
                {address === nft.owner && (
                  <div className="mt-4 px-4 flex items-start xl:items-end gap-2">
                    <StandardButton
                      className="w-full gradient-2 rounded-[5vmax]"
                      onClick={() =>
                        window.open(
                          'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet'
                        )
                      }
                    >
                      {'Get $MOONEY'}
                    </StandardButton>
                    <StandardButton
                      className="w-full gradient-2 rounded-[5vmax]"
                      onClick={() => router.push('/lock')}
                    >
                      {'Stake $MOONEY'}
                    </StandardButton>
                  </div>
                )}
              </div>
            </Frame>

            <Frame
              noPadding
              bottomLeft="0px"
              bottomRight="0px"
              topRight="0px"
              topLeft="0px"
              >
              <div className="flex flex-col 2xl:flex-row">
                <div className="mb-10 w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
                  <p className="header font-GoodTimes opacity-[50%]">Teams</p>  
                  <div className="mt-5 py-5 flex flex-col gap-2 overflow-y-scroll">
                    {hats.map((hat: any) => (
                      <div
                        key={hat.id}
                        className="py-3 gradient-16 rounded-[20px]"
                      >
                        <Hat
                          selectedChain={selectedChain}
                          hatId={hat.id}
                          hatsContract={hatsContract}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {/* General Actions */}
              </div>
            </Frame>
            {address === nft.owner && (
              <Frame
                noPadding
                bottomLeft="0px"
                bottomRight="0px"
                topRight="0px"
                topLeft="0px"
              >
                <GeneralActions />
              </Frame>
            )}
          </div>
        ) : (
          // Subscription expired
          <Card>
            <p className="text-moon-orange">
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

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const tokenId: any = params?.tokenId

  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)
  const teamContract = await sdk.getContract(CITIZEN_ADDRESSES[chain.slug])
  const nft = await teamContract.erc721.get(tokenId)

  if (!nft || !nft.metadata.uri || blockedCitizens.includes(nft.metadata.id)) {
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
