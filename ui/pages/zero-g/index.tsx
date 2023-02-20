import { useRouter } from 'next/router'
import { getUserDiscordData } from '../../lib/discord'
import ZeroGRaffle from '../../components/ZeroGRaffle'
import MainCard from '../../components/layout/MainCard'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  return (
    <div className="flex flex-col justify-center gap-4">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-GoodTimes mb-2">Zero-G Flight</h1>
        <p className="font-RobotoMono">{`MoonDAO is organizing a charter flight and JSC tour in association with other events in the Houston, Texas area on June 9th, in partnership with Space for a Better World. The main event is a ZeroG charter flight with two astronauts in attendance. The flight has 28 seats, which will be sold to the public and of which a portion will be VIP tickets, a portion will also be reserved for raffles, various partners, and causes.
`}</p>
        <button
          onClick={() => router.push('/zero-g/about')}
          className="absolute font-RobotoMono my-2 text-n3blue hover:scale-[1.05] ease-in-ease-out duration-300"
        >
          Learn more...
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
