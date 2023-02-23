import Link from 'next/link'
import { useRouter } from 'next/router'
import { getUserDiscordData } from '../../lib/discord'
import MainCard from '../../components/layout/MainCard'
import ZeroGRaffle from '../../components/zero-g-raffle/ZeroGRaffle'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  return (
    <MainCard className="gap-4" title="Zero-G Flight">
      <div className="mb-2 max-w-2xl font-RobotoMono">
        <div className="flex">
          <p className="">
            {`In partnership with `}
            <button
              className="text-n3blue hover:scale-[1.025] ease-in-ease-out duration-300"
              onClick={() => window.open('https://spaceforabetterworld.com/')}
            >
              {'Space for a Better World'}
            </button>
          </p>
        </div>
        <p className="font-RobotoMono">
          {`MoonDAO is organizing a ZeroG event at Johnson Space Center! Join astronauts Doug Hurley and Nicole Stott as we journey beyond the limits of Earth's gravity.
Witness breathtaking views of our planet as you float and soar in a weightless environment. Start your journey to the Moon and experience the adventure of a lifetime with our ZeroG flight! 
`}
        </p>

        <button
          onClick={() => router.push('/zero-g/detail')}
          className="font-RobotoMono my-2 text-n3blue hover:scale-[1.05] ease-in-ease-out duration-300"
        >
          Event Details...
        </button>
      </div>
      <MainCard>
        <h1 className="font-GoodTimes text-3xl">Payment Portal</h1>
      </MainCard>
      <ZeroGRaffle userDiscordData={userDiscordData} router={router} />
    </MainCard>
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
