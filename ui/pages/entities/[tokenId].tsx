import {
  ArrowUpRightIcon,
  GlobeAltIcon,
  PlusCircleIcon,
  SquaresPlusIcon,
} from '@heroicons/react/24/outline'
import { useContract, useNFT } from '@thirdweb-dev/react'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useNewestProposals } from '@/lib/snapshot/useNewestProposals'
import { CopyIcon, DiscordIcon, TwitterIcon } from '@/components/assets'
import { CoordinapeLogo } from '@/components/assets/CoordinapeLogo'
import { JuiceboxLogo } from '@/components/assets/JuiceboxLogo'
import TelegramIcon from '@/components/assets/TelegramIcon'

function Card({ children, className = '' }: any) {
  return <div className={`p-4 bg-[#080C20] ${className}`}>{children}</div>
}

function Button({ children, onClick }: any) {
  return (
    <button
      className="w-[200px] h-[50px] px-4 py-2 text-moon-orange border-moon-orange border-2 flex items-center gap-2 hover:scale-105 duration-300"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function EntityDetailPage({ tokenId }: any) {
  // const {contract: entityContract} = useContract(ENTITY_CONTRACT_ADDRESS);
  // const {nft} = useNFT(entityContract, tokenId);
  // const {multisigAddress, members, updateEntityMembers} = useEntityMetadata(entityContract, nft);

  const newestProposals = useNewestProposals(3)

  return (
    <div className="animate-fadeIn flex flex-col gap-6">
      {/* Header and socials */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            {false ? (
              <div></div>
            ) : (
              <div className="w-[100px] h-[100px] rounded-full bg-[#ffffff25] animate-pulse" />
            )}
            <div>
              <h1 className="text-white text-3xl">Entity Name</h1>
              <button
                className="flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
                onClick={() => {
                  navigator.clipboard.writeText('multisigAddress')
                  toast.success('Address copied to clipboard')
                }}
              >
                {'Entity Address'}
                <CopyIcon />
              </button>
            </div>
          </div>
          <p className="py-2 px-4 border-2 rounded-full border-moon-green text-moon-green max-w-[175px]">
            ✓ 12 Month Pass
          </p>
        </div>

        <p className="mt-4">{`Qorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
        {/* Socials */}
        <div className="mt-4 flex items-center gap-12">
          <TwitterIcon />
          <DiscordIcon />
          <GlobeAltIcon height={30} width={30} />
          <TelegramIcon />
        </div>
      </Card>

      {/* Mooney and Voting Power */}
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="w-full md:w-1/2 flex flex-col gap-4">
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
          <Button>
            <ArrowUpRightIcon height={20} width={20} />
            {'Manage Treasury'}
          </Button>
        </Card>
        <Card className="w-full md:w-1/2 flex flex-col md:flex-row">
          <div className="w-3/4">
            <p>{`Total $MOONEY`}</p>
            <p className="text-3xl">{`111,111`}</p>
            <p className="mt-8">{`Total Voting Power`}</p>
            <p className="text-3xl">{`11,111,111`}</p>
          </div>
          <div className="mt-2 flex flex-col justify-evenly gap-2">
            <Button>
              <PlusCircleIcon height={30} width={30} />
              {'Get $MOONEY'}
            </Button>
            <Button>
              <ArrowUpRightIcon height={20} width={20} />
              {'Stake $MOONEY'}
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Proposals */}
        <Card className="w-full md:w-2/3">
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
          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <Button>Create Proposals</Button>
            <Button>Vote on Proposals</Button>
            <Button>Receive Funding</Button>
          </div>
        </Card>
        {/* Members */}
        <Card className="w-full md:w-1/3">
          <p>Members</p>
          {}
          <Button>Add members</Button>
        </Card>
      </div>
      {/* General Actions */}
      <div className="flex flex-col gap-4">
        <p className="p-4">General Actions</p>
        <div className="flex flex-col md:flex-row gap-8">
          <Card className="p-8 w-full md:w-2/5">
            <CoordinapeLogo />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Give</p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Rewards</p>
            </div>
          </Card>
          <Card className="p-8 w-full md:w-2/5">
            <JuiceboxLogo />
            <p className="mt-2">{`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}</p>
            <div className="mt-8 flex gap-4">
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">
                Crowdfunding
              </p>
              <p className="py-2 px-4 bg-[#ffffff25] rounded-full">Payout</p>
            </div>
          </Card>
          <Card className="w-full md:w-1/5 flex flex-col justify-center items-center">
            <p>Explore more apps</p>
            <SquaresPlusIcon height={40} width={40} />
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
