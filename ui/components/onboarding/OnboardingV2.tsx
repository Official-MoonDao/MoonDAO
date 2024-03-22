import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { HATS_ADDRESS } from 'const/config'
import Image from 'next/image'
import { useContext, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { CreateEntity } from './CreateEntity'

type TierProps = {
  label: string
  description: string
  points: string[]
  onClick: () => void
}

function Tier({ label, description, points, onClick }: TierProps) {
  const { user } = usePrivy()

  const { login } = useLogin()

  return (
    <div
      className="w-full transition-all duration-150 text-black cursor-pointer dark:text-white md:p-8 flex flex-col border-[2px] hover:border-orange-500 hover:border-moon-orange border-opacity-100 bg-[#0A0E22] p-3"
      onClick={() => {
        if (!user) login()
        else onClick()
      }}
    >
      <div className="w-full h-full flex flex-col lg:flex-row justify-center items-center md:space-x-10">
        <div className="flex justify-center items-center">
          <Image
            src={
              label === 'ENTITY'
                ? '/onboarding-icons/entity-creation-icon.png'
                : '/onboarding-icons/citizen-creation-icon.png'
            }
            width={254}
            height={312}
            alt=""
          />
        </div>

        <div className="flex flex-col justify-between w-full items-start">
          <div className="flex flex-col space-y-5">
            <p className="md:p-2 text-sm text-moon-orange rounded-full bg-red-600 bg-opacity-10">
              {description}
            </p>
            <h1 className={'font-GoodTimes text-3xl'}>{label}</h1>
            <div>
              {points.map((p: any, i: number) => (
                <div
                  className="flex flex-row bg-[#FFFFFF08] bg-opacity-3 p-2 rounded-sm space-x-2"
                  key={`${label}-tier-point-${i}`}
                >
                  <p className="h-6 w-6 flex justify-center items-center rounded-full bg-[#FFFFFF1A] bg-opacity-10 px-2 ">
                    ✓
                  </p>
                  <p>{p}</p>
                </div>
              ))}
            </div>
          </div>
          {/* <button className="self-start p-2 text-moon-orange rounded-full bg-moon-orange bg-opacity-10 after:content-['_↗']">
            See more
          </button> */}
        </div>
      </div>
    </div>
  )
}

function BackButton({ setSelectedTier }: any) {
  return (
    <button onClick={() => setSelectedTier(null)}>
      <Image src={'/x-white.png'} width={30} height={30} alt="" />
    </button>
  )
}

export function OnboardingV2({ selectedChain }: any) {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [selectedTier, setSelectedTier] = useState<'entity' | 'citizen'>()

  const { contract: hatsContract } = useContract(HATS_ADDRESS)

  if (selectedTier === 'citizen') {
    return (
      <div>
        <BackButton setSelectedTier={setSelectedTier} />
      </div>
    )
  }

  if (selectedTier === 'entity') {
    return (
      <div>
        <CreateEntity
          address={address}
          selectedChain={selectedChain}
          selectedWallet={selectedWallet}
          wallets={wallets}
          hatsContract={hatsContract}
          setSelectedTier={setSelectedTier}
        />
      </div>
    )
  }

  return (
    <div className="space-y-10 mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 font-RobotoMono w-screen sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1256px] text-slate-950 dark:text-white">
      <div className="flex flex-col space-y-7">
        <div className="flex flex-col  space-y-7">
          <Tier
            label="Become a citizen"
            description="Join the internet's space program today!"
            points={[
              'Become a Citizen of the MoonDAO community.',
              'Access the biggest network of startups, nations, and individuals working to create a long-term presence on the lunar surface.',
              'Help govern the fate of the first off-world settlement.',
            ]}
            onClick={() => setSelectedTier('citizen')}
          />
          <Tier
            label="Register an entity"
            description="Bring your entity onchain today!"
            points={[
              'Bring your organization onchain by registering your entity with MoonDAO.',
              "Apply for funding from MoonDAO's multi-million dollar treasury.",
              'Recruit from our community and network with other cutting-edge organizations.',
              'Access the frontier of onchain tooling to manage your organization and interface with any other onchain contracts.',
              'List your products and services on the MoonDAO Marketplace.',
            ]}
            onClick={() => setSelectedTier('entity')}
          />
        </div>
      </div>
    </div>
  )
}
