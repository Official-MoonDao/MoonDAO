import { useAddress, useContract } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useVMOONEYLock } from '../../lib/tokens/ve-token'
import { getUserDiscordData } from '../../lib/utils/discord'
import Head from '../../components/layout/Head'
import PurchasePortal from '../../components/zero-g/PurchasePortal'
import ZeroGRaffle from '../../components/zero-g/ZeroGRaffle'
import VotingEscrowABI from '../../const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES, VMOONEY_SWEEPSTAKES } from '../../const/config'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  const address = useAddress()

  const { contract: sweepstakesContract }: any =
    useContract(VMOONEY_SWEEPSTAKES)

  const { contract: L1vMooneyContract }: any = useContract(
    VMOONEY_ADDRESSES['ethereum'],
    VotingEscrowABI.abi
  )

  const { contract: L2vMooneyContract }: any = useContract(
    VMOONEY_ADDRESSES['polygon'],
    VotingEscrowABI.abi
  )

  const { data: L1vMooneyLock, isLoading: L1vMooneyLockLoading } =
    useVMOONEYLock(L1vMooneyContract, address)

  const { data: L2vMooneyLock, isLoading: L2vMooneyLockLoading } =
    useVMOONEYLock(L2vMooneyContract, address)

  const [validLock, setValidLock] = useState<boolean>()

  const sweepstakesSupply = 19

  useEffect(() => {
    if (L1vMooneyLock && L2vMooneyLock) {
      setValidLock(L1vMooneyLock[0] != 0 || L2vMooneyLock[0] != 0)
    }
  }, [L1vMooneyLock, L2vMooneyLock, address])

  return (
    <div className="animate-fadeIn">
      <Head title="Zero-G Flight" />

      <main className="mt-3 px-5 lg:px-8 xl:px-12 py-12 xl:py-16 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark lg:flex lg:flex-col lg:items-center">
        <h1
          className={`font-GoodTimes tracking-wide leading-relaxed text-center text-2xl xl:text-4xl font-semibold mb-2 text-title-light dark:text-title-dark`}
        >
          Zero-G Flight
        </h1>

        <div className="mt-3 lg:mt-6 font-RobotoMono">
          {/*Subtitle */}
          <div className="mt-4 text-center leading-10 text-light-text dark:text-dark-text">
            <p className="lg:text-lg">
              {`In partnership with `}
              <br />
              <a
                target="_blank"
                rel="noreferrer"
                className="inline-block lg:mt-3 text-moon-blue cursor-pointer dark:text-moon-gold hover:scale-[1.025] ease-in-ease-out duration-300"
                onClick={() => window.open('https://spaceforabetterworld.com/')}
              >
                {'Space for a Better World'}
              </a>
            </p>
          </div>

          <p className="mt-6 font-mono text-base xl:text-lg xl:leading-10 text-center leading-8 text-light-text dark:text-dark-text dark:text-opacity-80">
            {`Join Astronauts Doug Hurley and Nicole Stott on this one-of-a-kind opportunity to experience true weightlessness. The team’s Boeing 727 flies in parabolic arcs to create a weightless environment, allowing you to float, flip, and soar as if you were in space. Start training for a journey to the Moon and experience the adventure of a lifetime with our Zero-G flight!`}
          </p>

          <Link href="/zero-g/detail">
            <p
              className={`mt-10 xl:text-lg block text-center text-md font-GoodTimes font-semibold bg-gradient-to-r from-blue-500 to-blue-700 dark:decoration-detail-dark dark:from-moon-gold dark:to-stronger-dark  underline decoration-detail-light hover:scale-105 transition-all duration-150 text-transparent bg-clip-text`}
            >
              Event Details →
            </p>
          </Link>
        </div>

        {/*Separating line*/}
        <div className="my-8 xl:mt-5 w-full flex justify-center">
          <div className="flex justify-center h-[2px] bg-gradient-to-r from-detail-light to-moon-blue dark:from-detail-dark dark:to-moon-gold lg:mt-7 lg:h-[3px] w-5/6"></div>
        </div>

        <section className="w-full flex flex-col items-center gap-5 xl:gap-8">
          <PurchasePortal validLock={validLock} />
          <ZeroGRaffle
            sweepstakesContract={sweepstakesContract}
            userDiscordData={userDiscordData}
            router={router}
            validLock={validLock}
            address={address}
            supply={sweepstakesSupply}
          />
        </section>
      </main>
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
