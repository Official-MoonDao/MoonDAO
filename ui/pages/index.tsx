import { useRouter } from 'next/router'
import Head from '../components/layout/Head'

export default function Home() {
  const router = useRouter()

  return (
    <div className="animate-fadeIn">
      <Head title="Home" />

      <div id="home-hero" className="flex flex-col pt-10 w-full">
        <div className="flex flex-col items-left px-4 lg:px-7 xl:px-9">
          <h2 className="text-[#071732] dark:text-white font-GoodTimes text-4xl sm:text-5xl lg:text-4xl xl:text-5xl text-center lg:text-left">
            Welcome to MoonDAO
          </h2>
          <p className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
            {`MoonDAO is accelerating humanity’s development of a lunar base through better coordination. Want to help? This flow will onboard you into our in less than 5 minutes, even if you’re new to Web3.`}
          </p>
          <iframe
            className="mt-10 lg:mt-4 xl:mt-6 w-full xl:w-5/6 aspect-video object-cover"
            src="https://www.youtube.com/embed/Vs_vAtRgaBA?autoplay=0&showinfo=0&controls=0&rel=0"
            allowFullScreen
          />
          <button
            className="mt-10 px-8 py-4 lg:w-[300px] font-RobotoMono font-bold w-full bg-moon-orange text-white hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange"
            onClick={() => {
              router.push('/onboarding')
            }}
          >
            Join MoonDAO
          </button>
        </div>
        <div className="px-4 py-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="mx-auto text-start">
            <h2 className="text-2xl text-[#071732] dark:text-white font-GoodTimes sm:text-4xl lg:text-4xl xl:text-4xl text-center lg:text-left">
              Why Join MoonDAO?
            </h2>
          </div>
          <dl className="mt-12 space-y-10 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-2 lg:gap-x-8">
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-RobotoMono font-medium text-center lg:text-left">
                  Help Decentralize Access to Space
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  Ensure our multi-planetary future isn’t the exclusive domain
                  of a few governments and billionaires. By working together to
                  support a borderless, decentralized future that's open to all
                  dedicated to building off-world, irrespective of national
                  borders or geopolitics. MoonDAO is coordinating engineers,
                  scientists, researchers, artists, devs, and space enthusiasts
                  from all over the world to accelerate progress.
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-RobotoMono font-medium text-center lg:text-left">
                  Shape Our Community’s Destiny
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  Be an integral part of MoonDAO's vibrant community by actively
                  participating in discussions, governance, voting, and
                  initiatives. Shape the community's direction, voice your
                  ideas, and foster connections with fellow members. Your input
                  counts in building a strong and supportive network that
                  propels us toward a shared interstellar future.
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-RobotoMono font-medium text-center lg:text-left">
                  Co-Create a Lunar Settlement
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  Participate in shaping MoonDAO's direction through
                  governance—guide the allocation of resources in our treasury,
                  influence organizational decisions, and participate in direct
                  governance as well as leadership elections.
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-medium font-RobotoMono text-center lg:text-left">
                  Get Funding for R&D
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 text-sm font-RobotoMono sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  MoonDAO helps fund research and development projects from all
                  over the world that are helping to decentralize access to
                  space. Have a revolutionary idea? Pitch it to our community to
                  get your project funded. Want to join a cutting edge team?
                  Join a MoonDAO project.
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-RobotoMono font-medium text-center lg:text-left">
                  Network with Space Professionals
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  Connect and collaborate with a global network of like-minded
                  visionaries, builders, and thought leaders, fostering
                  innovation toward an open-source and open-space policy
                  framework, including gaining access to funding opportunities
                  or builders that can bring things to fruition.
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-medium font-RobotoMono text-center lg:text-left">
                  Savings on Space Ventures
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  Use your $MOONEY to access discounts on space-related products
                  and services through the MoonDAO marketplace, including our
                  DNA Mission to the Moon, digital assets, and more. Stay up to
                  date as we take steps to make it available for community
                  members to list their own offerings for $MOONEY!
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-RobotoMono font-medium text-center lg:text-left">
                  Access to Extraordinary Events
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  Enjoy access to exclusive events like our Ticket to Space
                  sweepstakes, Zero Gravity training with NASA astronauts, and
                  other and other unforgettable experiences.
                </dd>
              </div>
            </div>
            <div className="flex">
              <div className="ml-3">
                <dt className="text-lg font-medium font-RobotoMono text-center lg:text-left">
                  Let’s Build Together
                </dt>
                <dd className="mt-5 lg:mt-4 xl:mt-6 font-RobotoMono text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">
                  MoonDAO is only getting started with everything it plans to
                  achieve and you can help shape the directions and achievements
                  of the world’s largest Space Network State as humanity moves
                  off-world.
                </dd>
              </div>
            </div>
          </dl>
          <div className="flex justify-left">
            <button
              className="mt-10 px-8 py-4 lg:w-[300px] w-full bg-moon-orange text-white font-RobotoMono font-bold hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange"
              onClick={() => {
                router.push('/onboarding')
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
