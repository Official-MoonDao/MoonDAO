import { useAddress } from '@thirdweb-dev/react'
import Image from 'next/image'
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
            {`Fill out the form below to be contacted about future ticket sales.`}
          </p>
          <iframe
            className="mt-6 aspect-video object-cover w-full"
            src="https://www.youtube.com/embed/l8fFZtgBrIY?showinfo=0&controls=1&rel=0&mute=1&autoplay=1"
            allowFullScreen
          />
          <p className="mt-6 font-Lato text-base xl:text-lg lg:text-left text-center text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`Welcome to MoonDAO's Astronaut Training Program. We've partnered with `}
            <Link
              href="https://spaceforabetterworld.com/"
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-moon-orange ease-in-ease-out duration-300"
            >
              {'Space for a Better World '}
            </Link>
            {
              'to bring these VIP training opportunities to people alongside experienced NASA astronauts. Our first flight out of Kennedy Space Center featured legendary Apollo 16 Moonwalker Charlie Duke, NASA and SpaceX astronaut Doug Hurley, and NASA astronaut Nicole Stott in zero gravity.'
            }
          </p>

          <p className="mt-6 font-Lato text-base xl:text-lg lg:text-left text-center text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`The airplane flies in parabolic arcs to create a weightless environment, allowing you to float, flip, and soar as if you were in space. Start training for a journey to the Moon and experience the adventure of a lifetime with a zero gravity flight!`}
          </p>
        </div>

        <section className="mt-4 w-full flex flex-col items-start">
          {/* <PurchasePortal validVP={validVP} /> */}
          <h1 className="mt-4 font-bold text-2xl">{'Contact:'}</h1>
          <p className="mt-6 font-Lato text-base xl:text-lg lg:text-left text-center text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`Fill out the form below to get notified about ticket sales for future VIP training opportunities in zero gravity.`}
          </p>
          <div className="w-full">
            <ZeroGContact />
          </div>
        </section>
      </div>
    </main>
  )
}
