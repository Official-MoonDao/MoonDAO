import { useAddress, useContract } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useVMOONEYLock } from '../../lib/tokens/ve-token'
import { getUserDiscordData } from '../../lib/utils/discord'
import WebsiteHead from '../../components/layout/Head'
import PurchasePortal from '../../components/zero-g/PurchasePortal'
import ZeroGLayout from '../../components/zero-g/ZeroGLayout'
import ZeroGRaffle from '../../components/zero-g/ZeroGRaffle'
import VotingEscrowABI from '../../const/abis/VotingEscrow.json'
import vMooneySweepstakesABI from '../../const/abis/vMooneySweepstakes.json'
import useContractConfig from '../../const/config'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  const address = useAddress()

  const { vMOONEYToken, vMooneySweepstakesZeroG } = useContractConfig()

  const { contract: sweepstakesContract }: any = useContract(
    vMooneySweepstakesZeroG
  )

  const { contract: vMooneyContract }: any = useContract(
    vMOONEYToken,
    VotingEscrowABI.abi
  )
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    vMooneyContract,
    address
  )
  const [validLock, setValidLock] = useState<boolean>()

  const sweepstakesSupply = 19

  useEffect(() => {
    if (!vMooneyLockLoading && vMooneyLock) {
      setValidLock(vMooneyLock && vMooneyLock[0] != 0)
    }
  }, [vMooneyLock, address])

  return (
    <div className="animate-fadeIn">
      <WebsiteHead title="Zero-G Flight" />
      <ZeroGLayout className="gap-4 relative" title="Zero-G Flight">
        <div className="mt-3 font-RobotoMono">
          <div className="flex">
            <p className="lg:text-lg">
              {`In partnership with `}
              <button
                className="text-n3blue hover:scale-[1.025] ease-in-ease-out duration-300"
                onClick={() => window.open('https://spaceforabetterworld.com/')}
              >
                {'Space for a Better World'}
              </button>
            </p>
          </div>
          <p className="mt-5 font-RobotoMono leading-relaxed">
            {`Join Astronauts Doug Hurley and Nicole Stott on this one-of-a-kind opportunity to experience true weightlessness. The team’s Boeing 727 flies in parabolic arcs to create a weightless environment, allowing you to float, flip, and soar as if you were in space. Start training for a journey to the Moon and experience the adventure of a lifetime with our Zero-G flight!`}
          </p>

          <Link href="/zero-g/detail">
            <p
              className={`my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
            >
              Event Details →
            </p>
          </Link>
        </div>
        <PurchasePortal validLock={validLock} />
        <ZeroGRaffle
          sweepstakesContract={sweepstakesContract}
          userDiscordData={userDiscordData}
          router={router}
          validLock={validLock}
          address={address}
          supply={sweepstakesSupply}
        />
      </ZeroGLayout>
    </div>
  )
}

export async function getServerSideProps(context: any) {
  const code = context?.query?.code
  let userDiscordData = {}
  if (code) userDiscordData = (await getUserDiscordData(code)) || {}
  return {
    props: {
      userDiscordData,
    },
  }
}
