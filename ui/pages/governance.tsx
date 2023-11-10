import {
  BuildingLibraryIcon,
  DocumentCheckIcon,
  LightBulbIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/solid'
import { useAddress } from '@thirdweb-dev/react'
import Image from 'next/image'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useDelegateVotingPower } from '../lib/privy/hooks/useDelegateVotingPower'
import Head from '../components/layout/Head'

type InvolvementCardProps = {
  properties: {
    title: string
    description: string
    CTA: string
    icon: React.ForwardRefExoticComponent<
      Omit<React.SVGProps<SVGSVGElement>, 'ref'>
    >
    onClick: any
  }
  children?: any
}

const InvolvementCard = ({ properties, children }: InvolvementCardProps) => {
  return (
    <div className="text-gray-900 dark:text-white flex flex-col items-center lg:flex-row w-[327px] lg:w-full inner-container-background lg:justify-around lg:items-start py-8 px-5 border-white border-opacity-20 border font-RobotoMono">
      <properties.icon
        className={'h-[60px] w-[60px] text-slate-900 dark:text-white'}
      />
      <div className="mt-7 lg:mt-0 flex flex-col items-center lg:w-2/3 lg:items-start">
        <h1 className="font-bold text-[20px]">{properties.title}</h1>
        <p className="mt-3 opacity-60 text-center lg:text-left text-base xl:min-h-[170px]">
          {properties.description}
        </p>
        <button
          onClick={properties?.onClick}
          className="mt-10 px-5 py-3 text-base text-white bg-moon-orange transition-all duration-150 hover:bg-white hover:text-moon-orange"
        >
          {properties.CTA}
        </button>
        {children}
      </div>
    </div>
  )
}

export default function Governance() {
  const address = useAddress()
  const [delegateAddress, setDelegateAddress] = useState<string>('')
  const { mutateAsync: delegateVotingPower } =
    useDelegateVotingPower(delegateAddress)

  return (
    <div className="animate-fadeIn">
      <Head title="Governance" description="MoonDAO Governance introduction." />
      <div className="flex flex-col items-center lg:items-start px-5 lg:px-7 xl:px-9 py-12 lg:mt-8 w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1080px] font-RobotoMono">
        {/*Title*/}
        <h2 className="text-[#071732] dark:text-white font-GoodTimes text-3xl lg:text-5xl xl:text-6xl text-center lg:text-left">
          Governance
        </h2>

        <p className="mt-5 xl:mt-7 max-w-xs lg:w-full dark:bg-[#D7594F36] bg-[#CBE4F766] dark:text-white text-gray-900 px-2 py-2 xl:py-3 xl:px-4 lg:max-w-[950px] text-center xl:text-left text-sm xl:text-base">
          MoonDAO’s Treasury is governed by all the token holders. If you have
          voting power, follow these steps to get setup for voting.
          <br />
          <br />
          You can read MoonDAO’s Constitution to understand more about how our
          governance works.
        </p>
        {/*Section containing cards with links*/}
        <section className="mt-5 xl:mt-10 grid grid-cols-1 xl:grid-cols-2 gap-7 xl:gap-8 w-full">
          <InvolvementCard
            properties={{
              title: 'Delegate Voting Power',
              description:
                "You can delegate your voting power to another wallet if you'd like. If you have a Gitcoin Passport with another wallet you can delegate here.",
              CTA: 'Delegate',
              icon: BuildingLibraryIcon,
              onClick: () => {
                if (!address) return toast.error('Please connect your wallet')
                if (
                  delegateAddress.trim().length !== 42 ||
                  !delegateAddress.startsWith('0x')
                )
                  return toast.error('Please enter a valid address')

                delegateVotingPower()
              },
            }}
          >
            {address && (
              <div className="py-2">
                <label>Delegate Address :</label>
                <input
                  className="text-black px-2"
                  type="text"
                  onChange={(e) => {
                    setDelegateAddress(e.target.value)
                  }}
                />
              </div>
            )}
          </InvolvementCard>
          <InvolvementCard
            properties={{
              title: 'Get Gitcoin Passport',
              description:
                'We require a score of 15 or above for voting. This is to make sure you are a unique human.',
              CTA: 'Get Passport',
              icon: DocumentCheckIcon,
              onClick: () => window.open('https://passport.gitcoin.co/'),
            }}
          />
          <InvolvementCard
            properties={{
              title: 'Submit a Proposal',
              description:
                'Proposals start in our “Ideation” channel in the Discord. Post your idea there to get feedback and start the submission process!',
              CTA: 'Discord Ideation',
              icon: LightBulbIcon,
              onClick: () =>
                window.open(
                  'https://discord.com/channels/914720248140279868/1027658256706961509'
                ),
            }}
          />
          <InvolvementCard
            properties={{
              title: 'Vote on Snapshot',
              description:
                'Our community uses Snapshot to vote. Click here to navigate and view active proposals.',
              CTA: 'Snapshot',
              icon: ArchiveBoxArrowDownIcon,
              onClick: () =>
                window.open('https://snapshot.org/#/tomoondao.eth'),
            }}
          />
        </section>
      </div>
    </div>
  )
}
