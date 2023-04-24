import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getUserDiscordData } from '../../lib/discord'
import { getSweepstakesSupply } from '../../lib/opensea'
import { useAccount } from '../../lib/use-wagmi'
import { useVMOONEYLock } from '../../lib/ve-token'
import WebsiteHead from '../../components/layout/Head'
import PurchasePortal from '../../components/zero-g/PurchasePortal'
import ZeroGLayout from '../../components/zero-g/ZeroGLayout'
import ZeroGRaffle from '../../components/zero-g/ZeroGRaffle'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  const { data: account } = useAccount()
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    account?.address
  )
  const [validLock, setValidLock] = useState<boolean>()
  const [sweepstakesSupply, setSweepstakesSupply] = useState<string>('')
  useEffect(() => {
    if (!vMooneyLockLoading && vMooneyLock) {
      setValidLock(vMooneyLock && vMooneyLock[0] != 0)
    }
  }, [vMooneyLock, account])

  useEffect(() => {
    ;(async () => {
      const supply: any = await getSweepstakesSupply()
      setSweepstakesSupply(supply)
    })()
  }, [])

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
            <a
              className={`my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
            >
              Event Details →
            </a>
          </Link>
        </div>
        <PurchasePortal validLock={validLock} />
        <ZeroGRaffle
          userDiscordData={userDiscordData}
          router={router}
          validLock={validLock}
          account={account}
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
