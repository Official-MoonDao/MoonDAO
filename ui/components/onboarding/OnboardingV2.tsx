//OnboardingV2
import { StarIcon } from '@heroicons/react/24/outline'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import Footer from '../layout/Footer'
import Frame from '../layout/Frame'
import InnerPreFooter from '../layout/InnerPreFooter'
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
  const { user, logout } = usePrivy()
  const { login } = useLogin({
    onComplete: (user, isNewUser, wasAlreadyAuthenticated) => {
      if (!wasAlreadyAuthenticated) onClick()
    },
  })

  const iconStar = './assets/icon-star.svg'

  return (
    <section
      id="callout-card-container"
      className="bg-darkest-cool md:bg-transparent"
    >
      <div className="bg-[#020617] md:mb-5 md:rounded-[5vmax] p-5 md:rounded-tl-[20px]">
        <div
          className="w-full transition-all duration-150 pb-10 cursor-pointer text-white text-opacity-[80%] flex flex-col"
          onClick={() => {
            if (!address && user) logout()
            if (!address) return login()
            if (hasCitizen)
              return toast.error('You have already registered as a citizen')

            onClick()
          }}
        >
          <div className="w-full h-full flex flex-col lg:flex-row ">
            <div className="pt-5 md:pt-0 flex items-center rounded-[2vmax] rounded-tl-[20px] overflow-hidden">
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

            <div className="flex flex-col p-5 justify-between w-full items-start">
              <div className="w-full flex-col space-y-5">
                <div className="md:rounded-[5vmax] md:rounded-tl-[20px]">
                  <h2 className={'mt-6 font-GoodTimes text-3xl'}>{label}</h2>
                  <p className="opacity-80">{description}</p>

                  <div className="flex flex-col w-full">
                    <div className="flex flex-col pt-5 items-start">
                      <div className="flex flex-row items-center space-x-2">
                        <p className="text-lg md:text-2xl">{price} ETH</p>
                        <p className="text-sm">/Year</p>
                      </div>
                      <p className="text-[#753F73] text-sm md:text-lg">
                        &#10003; 12 Month Passport
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 lg:mt-5">
            {points.map((p, i) => {
              const [title, description] = p.split(': ')
              return (
                <div
                  key={`${label}-tier-point-${i}`}
                  className="flex flex-row bg-opacity-3 pb-2 rounded-sm space-x-2"
                >
                  <Image
                    alt="Bullet Point"
                    src={iconStar}
                    width={30}
                    height={30}
                  ></Image>
                  <p>
                    <strong>{title}:</strong> {description}
                  </p>
                </div>
              )
            })}
          </div>
          <button className="mt-5 px-5 rounded-tl-[10px] rounded-[2vmax] py-3 hover:pl-5 ease-in-out duration-300 gradient-2 max-w-[250px]">
            {buttoncta}
          </button>
        </div>
      </div>
    </section>
  )
}

export function OnboardingV2({ selectedChain }: any) {
  const address = useAddress()
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
        setSelectedTier={setSelectedTier}
      />
    )
  }

  if (selectedTier === 'team') {
    return (
      <CreateTeam
        address={address}
        selectedChain={selectedChain}
        setSelectedTier={setSelectedTier}
      />
    )
  }

  return (
    <Container>
      <ContentLayout
        header="Join MoonDAO"
        headerSize="max(20px, 3vw)"
        mainPadding
        mode="compact"
        popOverEffect={false}
        description={
          <>
            Be part of the first open-source, interplanetary network state
            dedicated to establishing a permanent human presence on the Moon and
            beyond. Membership is currently invite-only, but you can register
            your interest by submitting an application or scheduling an
            onboarding call to see if you'd be a good fit.
          </>
        }
        preFooter={
          <div className="p-5 ">
            <div className="custom-break-padding gradient-15 ml-5 p-5 mr-5 pb-10 rounded-[5vmax] rounded-tl-[20px]">
              <div className="flex items-center">
                <div className="font-GoodTimes w-[40px] h-[40px] items-center justify-center flex rounded-[100px] bg-light-warm m-2">
                  ?
                </div>
                <div className="">
                  <h3 className="header opacity-80 font-GoodTimes">
                    Need Help?
                  </h3>
                </div>
              </div>
              <p className="pl-5 opacity-60">
                <Link
                  className="underline"
                  href="https://discord.com/channels/914720248140279868/1212113005836247050"
                >
                  Submit a ticket
                </Link>{' '}
                in our support channel on Discord!
              </p>
            </div>
            <Footer />
          </div>
        }
      >
        <div className="flex flex-col">
          <div className=" z-50 flex flex-col">
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
              buttoncta="Register As A Citizen"
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
              buttoncta="Register As A Team"
              onClick={() => setSelectedTier('team')}
            />
          </div>
        </div>
      </ContentLayout>
    </Container>
  )
}
