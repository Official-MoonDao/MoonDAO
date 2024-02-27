import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
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
  return (
    <div
      className="w-3/4 min-[1300px]:min-h-[300px] group transition-all duration-150 text-black cursor-pointer dark:text-white pb-8 px-7 flex flex-col items-center border-[2px] group hover:border-orange-500 font-RobotoMono hover:border-moon-orange border-opacity-100 bg-[#0d0a1b]"
      onClick={onClick}
    >
      <div className="w-full h-full flex flex-col md:flex-row justify-between">
        <Image
          src={'/onboarding-icons/citizen-white.svg'}
          width={100}
          height={100}
          alt=""
        />
        <div className="md:w-3/4">
          <h1
            className={`font-abel mt-[22px] text-3xl font-bold transition-all duration-150`}
          >
            {label}
          </h1>
          <p>{description}</p>
          <div className="w-full border-[1px] bg-white md:w-3/4" />
          <div>
            {points.map((p: any, i: number) => (
              <p key={`${label}-tier-point-${i}`}>{'✓' + p}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BackButton({ setSelectedTier }: any) {
  return (
    <button onClick={() => setSelectedTier(null)}>
      <Image src={'/backIcon.png'} width={50} height={50} alt="" />
    </button>
  )
}

export function OnboardingV2() {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [selectedTier, setSelectedTier] = useState<string>()

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
        <BackButton setSelectedTier={setSelectedTier} />
        <CreateEntity
          address={address}
          selectedWallet={selectedWallet}
          wallets={wallets}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center gap-12">
      <div className="flex flex-col gap-4 items-start lg:px-3 xl:px-9 py-4 lg:pb-14 lg:mt-1 md:max-w-[1080px]">
        <h1 className="text-3xl font-GoodTimes">Welcome to MoonDAO</h1>
        <p>
          Bein your journey with MoonDAO, participate in governance and decision
          making by voting on project, proposals, and treasury spending.
        </p>
      </div>

      <Tier
        label="Citizen"
        description="Bring yourself onchain today!"
        points={['Lorem ipsum', 'Lorem ipsum', 'Lorem ipsum']}
        onClick={() => setSelectedTier('citizen')}
      />
      <Tier
        label="Entity"
        description="Bring your entity onchain today!"
        points={['Lorem ipsum', 'Lorem ipsum', 'Lorem ipsum']}
        onClick={() => setSelectedTier('entity')}
      />
    </div>
  )
}