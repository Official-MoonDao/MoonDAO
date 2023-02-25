import { InformationCircleIcon } from '@heroicons/react/outline'
import { useRouter } from 'next/router'
import { getUserDiscordData } from '../../lib/discord'
import ThirdwebEditionDropEmbed from '../../components/ThirdwebEditionDropEmbed'
import GradientLink from '../../components/layout/GradientLink'
import Head from '../../components/layout/Head'
import MainCard from '../../components/layout/MainCard'
import Reservations from '../../components/zero-g/Reservations'

export default function ZeroG({ userDiscordData }: any) {
  const router = useRouter()
  return (
    <div className="animate-fadeIn">
      <Head title={'Zero-G Flight'} />
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

          <GradientLink
            text={'Event Details'}
            href="/zero-g/detail"
            internal={false}
            textSize={'md'}
          ></GradientLink>
        </div>
        <Reservations />
        {/* <ZeroGRaffle userDiscordData={userDiscordData} router={router} /> */}
        {/* <MainCard>
          <div className="flex alert bg-transparent border border-primary">
            <div className="flex justify-center items-center">
              <InformationCircleIcon className="text-primary h-8 w-8" />
              <p className="italic">Claim your free Zero-G NFT!</p>
            </div>
          </div>
          <ThirdwebEditionDropEmbed />
  </MainCard>*/}
      </MainCard>
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
