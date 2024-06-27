import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES } from 'const/config'
import Image from 'next/image'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import CreateCitizen from './CreateCitizen'
import CreateTeam from './CreateTeam'

type TierProps = {
  label: string
  description: string
  points: any[]
  price: number
  onClick: () => void
  hasCitizen?: boolean
  buttoncta: string
}

function Tier({
  label,
  description,
  points,
  buttoncta,
  price,
  onClick,
  hasCitizen = false,
}: TierProps) {
  const address = useAddress()
  const { user, login, logout } = usePrivy()

  return (
    <div
      className="w-full transition-all duration-150 text-black cursor-pointer dark:text-white lg:p-8 flex flex-col border-[2px] hover:border-moon-orange hover:border-moon-orange border-opacity-100 bg-[white] dark:bg-[#0A0E22] p-3"
      onClick={() => {
        if (!address && user) logout()
        if (!address) return login()
        if (hasCitizen)
          return toast.error('You have already registered as a citizen')

        onClick()
      }}
    >
      <div className="w-full h-full flex flex-col lg:flex-row justify-center items-center lg:space-x-10">
        <div className="flex justify-center items-center">
          <Image
            src={
              label === 'Register Now'
                ? '/image-generator/images/org-example.png'
                : '/image-generator/images/citizen_image.png'
            }
            width={506}
            height={506}
            alt=""
          />
        </div>

        <div className="flex flex-col justify-between w-full items-start">
          <div className="w-full flex flex-col space-y-5">
            <h1 className={'mt-6 font-GoodTimes text-3xl'}>{label}</h1>
            <p className="mt-4 md:mt-0 md:p-2 text-sm text-moon-orange bg-red-600 bg-opacity-10">
              {description}
            </p>
            <div className="flex flex-col bg-[#FFFFFF08] px-4 w-full">
              <div className="flex flex-col xl:flex-row justify-between py-4 items-center">
                <div className="flex flex-row items-center md:space-x-2 space-x-1">
                  <p className="text-lg md:text-2xl">{price} ETH</p>
                  <p className="text-sm">/Year</p>
                </div>
                <p className="text-green-500 text-sm md:text-lg">
                  &#10003; 12 Month Passport
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        {points.map((p, i) => {
          const [title, description] = p.split(': ')
          return (
            <div
              key={`${label}-tier-point-${i}`}
              className="flex flex-row bg-opacity-3 py-2 rounded-sm space-x-2"
            >
              <p className="h-6 w-6 flex justify-center items-center rounded-full bg-[#FFFFFF1A] bg-opacity-10 px-2">
                ✓
              </p>
              <p>
                <strong>{title}:</strong> {description}
              </p>
            </div>
          )
        })}
      </div>
      <button className="my-6 w-full border-2 border-moon-orange text-moon-orange rounded-full p-2 hover:scale-105 ease-in-out duration-300">
        {buttoncta}
      </button>
    </div>
  )
}

export function OnboardingV2({ selectedChain }: any) {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [selectedTier, setSelectedTier] = useState<'team' | 'citizen'>()

  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )

  const { data: citizenBalance } = useHandleRead(citizenContract, 'balanceOf', [
    address,
  ])

  if (selectedTier === 'citizen') {
    return (
      <CreateCitizen
        address={address}
        selectedChain={selectedChain}
        selectedWallet={selectedWallet}
        wallets={wallets}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  if (selectedTier === 'team') {
    return (
      <CreateTeam
        address={address}
        selectedChain={selectedChain}
        selectedWallet={selectedWallet}
        wallets={wallets}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  return (
    <div className="space-y-10 mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 font-RobotoMono w-screen sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white page-border-and-color">
      <h1 className="mt-2 lg:mt-3 leading-relaxed page-title">Join MoonDAO</h1>
      <p className="mt-5">
        {`Be part of the first open-source, interplanetary network state dedicated to establishing a permanent human presence on the Moon and beyond. Membership is currently invite-only, but you can register your interest by submitting an application or scheduling an onboarding call to see if you'd be a good fit.`}
      </p>
      <div className="flex flex-col space-y-7">
        <div className="flex flex-col  space-y-7">
          <Tier
            price={0.1}
            label="Become a Citizen"
            description="Citizens are the trailblazers supporting the creation of off-world settlements. Whether you're already part of a team or seeking to join one, everyone has a crucial role to play in this mission."
            points={[
              'Professional Networking: Connect with top space startups, non-profits, and ambitious teams.',
              'Career Advancement: Access jobs, gigs, hackathons, and more; building on-chain credentials to showcase your experience.',
              'Early Project Access: Engage in space projects early, earn money, and advance your career.',
              'Unique Identity: Create a personalized Passport representing your on-chain identity.',
            ]}
            buttoncta="Submit Your Application Now"
            onClick={() => setSelectedTier('citizen')}
            hasCitizen={+citizenBalance > 0}
          />
          <Tier
            price={0.5}
            label="Register a Team"
            description="Teams are driving innovation and tackling ambitious space challenges together. From non-profits to startups and university teams, every group has something to contribute to our multiplanetary future. Be a part of Team Space."
            points={[
              'Funding Access: Obtain seed funding from MoonDAO for your bold projects and initiatives.',
              'Professional Network: Hire top talent including full-time roles or posting bounties, and connect with other cutting-edge organizations.',
              'Marketplace Listing: Sell products and services in a dedicated space marketplace, whether payload space or satellite imagery.',
              'Capital Raising Tools: Leverage new tools to raise capital or solicit donations from a global network of space enthusiasts.',
              'Onchain Tools: Utilize advanced and secure onchain tools to manage your organization and interface with smart contracts.',
            ]}
            buttoncta="Schedule a Call to Apply"
            onClick={() => setSelectedTier('team')}
          />
        </div>
      </div>
    </div>
  )
}
