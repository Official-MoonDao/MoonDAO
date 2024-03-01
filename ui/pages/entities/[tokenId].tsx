import {
  ArrowUpRightIcon,
  GlobeAltIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { Sepolia } from '@thirdweb-dev/chains'
import {
  MediaRenderer,
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useNFT,
} from '@thirdweb-dev/react'
import {
  ENTITY_ADDRESSES,
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useEntityMetadata } from '@/lib/entity/useEntityMetadata'
import { useValidPass } from '@/lib/entity/useValidPass'
import { useNewestProposals } from '@/lib/snapshot/useNewestProposals'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { useVMOONEYBalance } from '@/lib/tokens/ve-token'
import { CopyIcon, DiscordIcon, TwitterIcon } from '@/components/assets'
import { CoordinapeLogo } from '@/components/assets/CoordinapeLogo'
import { JuiceboxLogo } from '@/components/assets/JuiceboxLogo'
import TelegramIcon from '@/components/assets/TelegramIcon'
import { EntityMembersModal } from '@/components/entity/EntityMembersModal'

function Card({ children, className = '', onClick }: any) {
  if (onClick)
    return (
      <button
        className={`p-4 bg-[#080C20] text-start ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    )

  return <div className={`p-4 bg-[#080C20] ${className}`}>{children}</div>
}

function Button({ children, onClick, className = '' }: any) {
  return (
    <button
      className={`w-[200px] h-[50px] px-4 py-2 text-moon-orange border-moon-orange border-2 flex items-center gap-2 hover:scale-105 duration-300 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function EntityDetailPage({ tokenId }: any) {
  const router = useRouter()
  const address = useAddress()

  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  const [entityMembersModalEnabled, setEntityMembersModalEnabled] =
    useState(false)

  //Entity Data
  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )
  const { data: nft } = useNFT(entityContract, tokenId)

  const { multisigAddress, members, socials, updateEntityMembers } =
    useEntityMetadata(entityContract, nft)

  const { data: expiresAt } = useHandleRead(entityContract, 'expiresAt', [
    nft?.metadata?.id || '',
  ])

  const validPass = useValidPass(expiresAt)

  //Entity Balances
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: MOONEYBalance } = useMOONEYBalance(
    mooneyContract,
    multisigAddress
  )

  const { contract: vMooneyContract } = useContract(
    VMOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: VMOONEYBalance } = useVMOONEYBalance(
    vMooneyContract,
    multisigAddress
  )

  const newestProposals = useNewestProposals(3)

  useEffect(() => {
    setSelectedChain(Sepolia)
  }, [])

  useEffect(() => {
    console.log(entityContract)
    console.log(nft)
  }, [entityContract, nft])

  return (
    <div className="animate-fadeIn flex flex-col gap-6">
      {/* Header and socials */}
      <Card>
        <div className="flex flex-col lg:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            {nft?.metadata.image ? (
              <ThirdwebNftMedia
                metadata={nft.metadata}
                height={'200px'}
                width={'200px'}
              />
            ) : (
              <div className="w-[200px] h-[200px] bg-[#ffffff25] animate-pulse" />
            )}
            <div>
              {nft ? (
                <h1 className="text-white text-3xl">{nft.metadata.name}</h1>
              ) : (
                <div className="w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
              )}
              {multisigAddress ? (
                <button
                  className="mt-4 flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
                  onClick={() => {
                    navigator.clipboard.writeText('multisigAddress')
                    toast.success('Address copied to clipboard')
                  }}
                >
                  {multisigAddress?.slice(0, 6) +
                    '...' +
                    multisigAddress?.slice(-4)}
                  <CopyIcon />
                </button>
              ) : (
                <div className="mt-4 w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
              )}
            </div>
          </div>
          {validPass && (
            <div className="flex flex-col items-center">
              <p className="py-2 px-4 border-2 rounded-full border-moon-green text-moon-green max-w-[175px]">
                ✓ 12 Month Pass
              </p>
              <p className="opacity-50">
                {'Exp: '}
                {new Date(expiresAt?.toString() * 1000).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {nft?.metadata.description ? (
          <p className="mt-4">{nft?.metadata.description || ''}</p>
        ) : (
          <div className="mt-4 w-full h-[30px] bg-[#ffffff25] animate-pulse" />
        )}
        {/* Socials */}
        <div className="mt-4 flex items-center gap-12">
          {socials ? (
            <>
              {socials.twitter && (
                <Link href={socials.twitter} target="_blank" passHref>
                  <TwitterIcon />
                </Link>
              )}
              {socials.discord && (
                <Link href={socials.discord} target="_blank" passHref>
                  <DiscordIcon />
                </Link>
              )}
              {socials.website && (
                <Link href={socials.website} target="_blank" passHref>
                  <GlobeAltIcon height={30} width={30} />
                </Link>
              )}
              {socials.telegram && (
                <Link href={socials.telegram} target="_blank" passHref>
                  <TelegramIcon />
                </Link>
              )}
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-[30px] h-[30px] bg-[#ffffff25] animate-pulse rounded-full"
              />
            ))
          )}
        </div>
      </Card>

      {/* Mooney and Voting Power */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className="flex justify-between">
            <p>{`Total asset value`}</p>
            <p className="p-2 bg-[#ffffff25] flex gap-2">
              <Image
                src="/icons/networks/ethereum.svg"
                width={10}
                height={10}
                alt=""
              />
              {`Ethereum`}
            </p>
          </div>
          <p className="text-3xl">{`111,111 USD`}</p>
          <Button
            onClick={() =>
              window.open(
                'https://app.safe.global/home?safe=eth:' + multisigAddress
              )
            }
          >
            <ArrowUpRightIcon height={20} width={20} />
            {'Manage Treasury'}
          </Button>
        </Card>
        <Card className="w-full lg:w-1/2 flex flex-col lg:flex-row">
          <div className="w-3/4">
            <p>{`Total $MOONEY`}</p>
            <p className="text-3xl">{MOONEYBalance?.toString() || 0}</p>
            <p className="mt-8">{`Total Voting Power`}</p>
            <p className="text-3xl">{VMOONEYBalance?.toString() || 0}</p>
          </div>
          <div className="mt-2 flex flex-col justify-evenly gap-2">
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
        <Card className="w-full lg:w-2/3">
          <p>MoonDAO Proposals</p>
          <div className="mt-2 flex flex-col gap-4">
            {newestProposals
              ? newestProposals.map((proposal: any) => (
                  <div
                    key={proposal.id}
                    className="p-2 flex justify-between bg-[#ffffff25] rounded-sm"
                  >
                    <div className="flex flex-col gap-2">
                      <p>{proposal.title}</p>
                    </div>
                    <p
                      className={`${
                        proposal.state === 'closed'
                          ? 'text-moon-orange'
                          : 'text-[green]'
                      }`}
                    >
                      {proposal.state}
                    </p>
                  </div>
                ))
              : Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full h-20 bg-[#ffffff25] animate-pulse"
                  />
                ))}
          </div>
          <div className="mt-4 flex flex-col lg:flex-row gap-2">
            <Button>Create Proposals</Button>
            <Button>Vote on Proposals</Button>
            <Button>Receive Funding</Button>
          </div>
        </Card>
        {/* Members */}
        {entityMembersModalEnabled && (
          <EntityMembersModal
            setEnabled={setEntityMembersModalEnabled}
            updateEntityMembers={() => {}}
          />
        )}
        <Card className="w-full lg:w-1/3">
          <p>Members</p>
          <div className="py-2 pr-4 flex flex-col gap-2 max-h-[300px] overflow-y-scroll">
            {members
              ? members.map((member: string) => (
                  <p
                    key={member}
                    className="py-4 px-2 w-full h-[50px] bg-[#ffffff25]"
                  >
                    {member.slice(0, 6) + '...' + member.slice(-4)}
                  </p>
                ))
              : Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="py-4 w-full h-[50px] bg-[#ffffff25] animate-pulse"
                  />
                ))}
          </div>

          <Button
            className="mt-2"
            onClick={() => {
              if (address != multisigAddress)
                return toast.error(
                  `Connect the entity's safe to update members`
                )
              setEntityMembersModalEnabled(true)
            }}
          >
            Add members
          </Button>
        </Card>
      </div>
      {/* General Actions */}
      <div className="flex flex-col gap-4">
        <p className="p-4">General Actions</p>
        <div className="flex flex-col lg:flex-row gap-8">
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
            onClick={() => window.open('https://coordinape.com/')}
          >
            <CoordinapeLogo />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Give</p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Rewards</p>
            </div>
          </Card>
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
            onClick={() => window.open('https://juicebox.money')}
          >
            <JuiceboxLogo />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
                Crowdfunding
              </p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Payout</p>
            </div>
          </Card>
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
            onClick={() => window.open('https://www.hatsprotocol.xyz/')}
          >
            <Image src="/logos/hats-logo.png" width={65} height={50} alt="" />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
                Coordination
              </p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Roles</p>
            </div>
          </Card>
        </div>
        {/* 2nd row of general actions */}
        <div className="mt-2 lg:mr-16 flex flex-col md:flex-row gap-8">
          <Card
            className="p-8 w-full lg:w-1/3 hover:scale-105 duration-300"
            onClick={() => window.open('https://passport.gitcoin.co/')}
          >
            <Image
              src="/logos/gitcoin-passport-logo.png"
              width={150}
              height={50}
              alt=""
            />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
                Reputation
              </p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Privacy</p>
            </div>
          </Card>
        </div>
      </div>
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
