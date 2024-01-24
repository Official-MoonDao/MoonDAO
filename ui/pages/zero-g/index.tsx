import { useAddress } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useValidVP } from '../../lib/tokens/hooks/useValidVP'
import Head from '../../components/layout/Head'
import { ZeroGContact } from '../../components/nodemailer/ZeroGContact'
import PurchasePortal from '../../components/zero-g/PurchasePortal'

export default function ZeroG() {
  const address = useAddress()

  const validVP = useValidVP(address)

  return (
    <main className="animate-fadeIn">
      <Head title="Zero-G Flight" />

      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[800px]">
        <h2 className="page-title">Zero-G Flight</h2>

        <div className="mt-3 lg:mt-4 font-Lato">
          <p className="mt-6 lg:mt-7 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg">
            Feb 23, 2024 at Kennedy Space Center, Florida
          </p>
          <iframe
            className="mt-6 aspect-video object-cover w-full"
            src="https://www.youtube.com/embed/Ie7WIhz99vU?showinfo=0&controls=1&rel=0&mute=1&autoplay=1"
            allowFullScreen
          />

          <p className="mt-6 font-Lato text-base xl:text-lg lg:text-left text-center text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`Welcome to MoonDAO's Astronaut Training Program. Learn from legendary Apollo 16 astronaut Charlie Duke, SpaceX Astronaut Doug Hurley, and NASA astronaut Nicole Stott how to float in Zero Gravity. MoonDAO has chartered an entire Zero Gravity flight in partnership with `}
            <Link
              href="https://spaceforabetterworld.com/"
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-moon-orange ease-in-ease-out duration-300"
            >
              {'Space for a Better World'}
            </Link>
            {'.'}
          </p>

          <p className="mt-6 font-Lato text-base xl:text-lg lg:text-left text-center text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`The team’s Boeing 727 flies in parabolic arcs to create a weightless environment, allowing you to float, flip, and soar as if you were in space. Start training for a journey to the Moon and experience the adventure of a lifetime with our Zero-G flight!`}
          </p>
        </div>

        <section className="mt-4 w-full flex flex-col items-start">
          {/* <PurchasePortal validVP={validVP} /> */}
          <h1 className="mt-4 font-bold text-2xl">{'Contact:'}</h1>
          <p className="mt-6 font-Lato text-base xl:text-lg lg:text-left text-center text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`Contact pablo@moondao.com or christina@spaceforabetterworld.com for more details or use the contact form below.`}
          </p>
          <div className="w-full">
            <ZeroGContact />
          </div>
        </section>
      </div>
    </main>
  )
}
