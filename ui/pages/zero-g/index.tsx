import { BigNumber } from 'ethers'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getUserDiscordData } from '../../lib/discord'
import { useAccount } from '../../lib/use-wagmi'
import { useVMOONEYLock } from '../../lib/ve-token'
import Head from '../../components/layout/Head'
import PurchasePortal from '../../components/zero-g/PurchasePortal'
import Reservations from '../../components/zero-g/Reservations'
import ZeroGLayout from '../../components/zero-g/ZeroGLayout'
import ZeroGRaffle from '../../components/zero-g/ZeroGRaffle'

const lockCutoff = +new Date('2023-01-09T00:00:00')

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  const { data: account } = useAccount()
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    account?.address
  )
  const [validLock, setValidLock] = useState<boolean>()

  useEffect(() => {
    if (account && vMooneyLock && vMooneyLock[1] !== 0) {
      setValidLock(BigNumber.from(lockCutoff).lte(vMooneyLock[1].mul(1000)))
    }
  }, [vMooneyLock, account])
  return (
    <div className="animate-fadeIn">
      <Head title="Zero-G Flight" />
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
            {`MoonDAO is organizing a ZeroG event at Johnson Space Center! Join astronauts Doug Hurley and Nicole Stott as we journey beyond the limits of Earth's gravity.
Witness breathtaking views of our planet as you float and soar in a weightless environment. Start your journey to the Moon and experience the adventure of a lifetime with our ZeroG flight! 
`}
          </p>

          <Link href="/zero-g/detail">
            <a
              className={`my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
            >
              Event Details →
            </a>
          </Link>
        </div>
        {/* <PurchasePortal validLock={validLock} /> */}

        <ZeroGRaffle
          userDiscordData={userDiscordData}
          router={router}
          validLock={validLock}
          account={account}
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
