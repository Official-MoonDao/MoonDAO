import Link from 'next/link'
import { useRouter } from 'next/router'
import { getUserDiscordData } from '../../lib/discord'
import MainCard from '../../components/layout/MainCard'
import ZeroGRaffle from '../../components/zero-g-raffle/ZeroGRaffle'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  return (
    <div className="flex flex-col justify-center gap-4">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-GoodTimes mb-2">Zero-G Flight</h1>
        <div className="flex gap-3 font-RobotoMono">
          <p className="">{`In partnership with`}</p>
          <button
            className="text-n3blue hover:scale-[1.025] ease-in-ease-out duration-300"
            onClick={() => window.open('https://spaceforabetterworld.com/')}
          >
            {'Space for a Better World'}
          </button>
        </div>
        <p className="font-RobotoMono">
          {`MoonDAO is organizing a ZeroG event at Johnson Space Center! Join astronauts Doug Hurley and Nicole Stott as we journey beyond the limits of Earth's gravity.
Witness breathtaking views of our planet as you float and soar in a weightless environment. Start your journey to the Moon and experience the adventure of a lifetime with our ZeroG flight! 
`}
        </p>

        <button
          onClick={() => router.push('/zero-g/detail')}
          className="absolute font-RobotoMono my-2 text-n3blue hover:scale-[1.05] ease-in-ease-out duration-300"
        >
          Event Details...
        </button>
      </div>
      <MainCard>
        <h1 className="font-GoodTimes text-3xl">Payment Portal</h1>
      </MainCard>
      <ZeroGRaffle userDiscordData={userDiscordData} />
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
