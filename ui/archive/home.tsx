import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import Head from '../components/layout/Head'

function HomeCard({ label, text }: any) {
  return (
    <div className="flex">
      <div>
        <dt className="text-lg font-RobotoMono font-medium text-left lg:text-left text-gray-950 dark:text-white">
          {label}
        </dt>
        <dd className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-left lg:text-left text-gray-600 dark:text-white dark:opacity-60">
          {text}
        </dd>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title={t('welcomeTitle')} description={t('welcomeDesc')} />

      <div
        id="home-hero"
        className="flex flex-col items-center lg:px-3 xl:px-9 py-4 lg:pb-14 lg:mt-1 md:max-w-[1080px]"
      >
        <div className="flex flex-col justify-center items-center w-[90%]">
          <h2 className="text-[#071732] dark:text-white font-GoodTimes text-3xl lg:text-4xl xl:text-5xl text-center">
            Mission Control
          </h2>
          <div className="mt-4 h-[1px] w-full bg-white"></div>
          <iframe
            className="mt-6 aspect-video object-cover w-full"
            src="https://www.youtube.com/embed/Vs_vAtRgaBA?showinfo=0&controls=1&rel=0&mute=1&autoplay=1"
            allowFullScreen
          />
          <p className="mt-6 sm:mt-6 lg:mt-8 text-sm sm:text-base lg:text-sm xl:text-base text-left lg:text-left text-gray-600 dark:text-white dark:opacity-60">
            {`MoonDAO is accelerating the development of a lunar base through better coordination. Want to help? This flow will onboard you into our community in less than 5 minutes, even if you’re new to Web3.`}
          </p>
          <div className="mt-8 h-[1px] w-full bg-white"></div>
        </div>

        <div className="mt-8 w-[90%]">
          <div className="">
            <h2 className="text-2xl text-[#071732] dark:text-white font-GoodTimes lg:text-4xl xl:text-4xl text-center">
              Why Join MoonDAO?
            </h2>
          </div>
          <dl className="mt-8 lg:mt-12 space-y-10 lg:space-y-0 lg:grid lg:gap-x-6 lg:gap-y-12 lg:grid-cols-2">
            <HomeCard
              label={`Help Decentralize Access to Space`}
              text={` Ensure our multi-planetary future isn’t the exclusive domain of a few
          governments and billionaires. By working together to support a
          borderless, decentralized future that's open to all dedicated to
          building off-world, irrespective of national borders or geopolitics.
          MoonDAO is coordinating engineers, scientists, researchers, artists,
          devs, and space enthusiasts from all over the world to accelerate
          progress.`}
            />
            <HomeCard
              label={`Shape Our Community’s Destiny`}
              text={` Be an integral part of MoonDAO's vibrant community by actively
                  participating in discussions, governance, voting, and
                  initiatives. Shape the community's direction, voice your
                  ideas, and foster connections with fellow members. Your input
                  counts in building a strong and supportive network that
                  propels us toward a shared interstellar future.`}
            />
            <HomeCard
              label={`Co-Create a Lunar Settlement`}
              text={`              Participate in shaping MoonDAO's direction through
                  governance—guide the allocation of resources in our treasury,
                  influence organizational decisions, and participate in direct
                  governance as well as leadership elections.`}
            />
            <HomeCard
              label={`Get Funding for R&D`}
              text={`   MoonDAO helps fund research and development projects from all
                  over the world that are helping to decentralize access to
                  space. Have a revolutionary idea? Pitch it to our community to
                  get your project funded. Want to join a cutting edge team?
                  Join a MoonDAO project.`}
            />
            <HomeCard
              label={`Network with Space Professionals`}
              text={`Connect and collaborate with a global network of like-minded
            visionaries, builders, and thought leaders, fostering
            innovation toward an open-source and open-space policy
            framework, including gaining access to funding opportunities
            or builders that can bring things to fruition.`}
            />
            <HomeCard
              label={`Savings on Space Ventures`}
              text={` Use your $MOONEY to access discounts on space-related products
                  and services through the MoonDAO marketplace, including our
                  DNA Mission to the Moon, digital assets, and more. Stay up to
                  date as we take steps to make it available for community
                  members to list their own offerings for $MOONEY!`}
            />
            <HomeCard
              label={`Access to Extraordinary Events`}
              text={`Enjoy access to exclusive events like our Ticket to Space
            sweepstakes, Zero Gravity training with NASA astronauts, and
            other unforgettable experiences.`}
            />
            <HomeCard
              label={`Let’s Build Together`}
              text={`             MoonDAO is only getting started with everything it plans to
                  achieve and you can help shape the directions and achievements
                  of the world’s largest Space Network State as humanity moves
                  off-world.`}
            />
          </dl>
          <div className="flex justify-center">
            <button
              className="mt-10 lg:mt-14 px-8 py-4 md:w-[400px] w-full bg-moon-orange text-white font-RobotoMono font-bold hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange"
              onClick={() => {
                router.push('/join')
              }}
            >
              Join MoonDAO
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
